import { useCallback, useEffect, useReducer, useRef } from "react";
import { ACCEPT_CONFIDENCE } from "../audio/chordDetector.js";
import { DEMO_SONG } from "../data/demoSong.js";
import { createEvaluator } from "./liveEvaluator.js";
import { createPracticeState, multiplierForStreak, practiceReducer } from "./model.js";

const REDUCED_MOTION_STEP_MS = 500;

function nextExcerptTime(elapsedMs, deltaMs, excerpt) {
  const duration = excerpt.endMs - excerpt.startMs;
  return excerpt.startMs + ((elapsedMs - excerpt.startMs + deltaMs) % duration + duration) % duration;
}

function crossedEvents(fromMs, deltaMs, song) {
  const { startMs, endMs } = song.excerpt;
  const events = [];
  let cursor = fromMs;
  let remaining = deltaMs;

  while (remaining > 0) {
    const untilEnd = endMs - cursor;
    const step = Math.min(remaining, untilEnd);
    const finish = cursor + step;
    events.push(...song.events.filter((event) => event.atMs > cursor && event.atMs <= finish));
    remaining -= step;
    cursor = finish === endMs ? startMs : finish;
  }

  return events;
}

export function usePracticeSession() {
  const [state, dispatch] = useReducer(practiceReducer, undefined, createPracticeState);
  const frameRef = useRef(null);
  const previousTimeRef = useRef(null);
  const elapsedRef = useRef(createPracticeState().elapsedMs);
  const visualDeltaRef = useRef(0);
  const stateRef = useRef(createPracticeState());
  const simulationEventRef = useRef(0);
  // Unwrapped song clock (keeps counting across excerpt loops) plus the last frame, so a strum's
  // wall-clock time can be mapped back onto the song.
  const unwrappedRef = useRef(createPracticeState().elapsedMs);
  const lastFrameRef = useRef(null);
  const evaluatorRef = useRef(null);
  if (evaluatorRef.current === null) evaluatorRef.current = createEvaluator(DEMO_SONG);
  const timeoutsRef = useRef(new Set());
  const reducedMotion = state.effects.reducedMotion || state.osReducedMotion;

  const scheduleCelebrationEnd = useCallback(() => {
    const timeout = window.setTimeout(() => {
      timeoutsRef.current.delete(timeout);
      dispatch({ type: "celebration/end" });
    }, 700);
    timeoutsRef.current.add(timeout);
  }, []);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const dispatchOutcome = useCallback((kind, timingMs, feedback) => {
    if (kind === "miss") {
      dispatch({ type: "practice/miss", payload: { feedback } });
      return;
    }
    dispatch({ type: kind === "late" ? "practice/late" : "practice/hit", payload: { timingMs } });
    if (multiplierForStreak(stateRef.current.streak + 1) > stateRef.current.multiplier) scheduleCelebrationEnd();
  }, [scheduleCelebrationEnd]);

  const dispatchSimulatedEvent = useCallback(() => {
    const cycleIndex = simulationEventRef.current % DEMO_SONG.simulation.cycleEvents;
    simulationEventRef.current += 1;
    if (cycleIndex === DEMO_SONG.simulation.missAt) dispatchOutcome("miss");
    else if (cycleIndex === DEMO_SONG.simulation.lateAt) dispatchOutcome("late", 96);
    else dispatchOutcome("hit", 18);
  }, [dispatchOutcome]);

  const handleVerdict = useCallback((verdict) => {
    if (verdict.kind === "hit" || verdict.kind === "late") dispatchOutcome(verdict.kind, verdict.timingMs);
    else if (verdict.kind === "wrong") dispatchOutcome("miss", 0, `OUVI ${verdict.heard} · TOQUE ${verdict.expected}`);
    else dispatchOutcome("miss", 0, `FALTOU O ${verdict.expected}`);
  }, [dispatchOutcome]);

  /** A strum from the live input: always shown as "heard"; judged only while playing and when clearly recognised. */
  const handleStrum = useCallback(({ perf, chord, confidence }) => {
    dispatch({ type: "input/heard", payload: { chord, confidence } });
    const frame = lastFrameRef.current;
    if (!stateRef.current.playing || !frame || !chord || confidence < ACCEPT_CONFIDENCE) return;
    const verdict = evaluatorRef.current.strum({ timeMs: frame.unwrappedMs + (perf - frame.timestamp), chord });
    if (verdict) handleVerdict(verdict);
  }, [handleVerdict]);

  const triggerScoreDemo = useCallback(() => {
    dispatch({ type: "demo/prime" });
    dispatch({ type: "practice/hit", payload: { timingMs: 18 } });
    scheduleCelebrationEnd();
  }, [scheduleCelebrationEnd]);

  useEffect(() => {
    if (!reducedMotion) {
      visualDeltaRef.current = 0;
      dispatch({ type: "clock/tick", payload: { elapsedMs: elapsedRef.current } });
    }
  }, [reducedMotion]);

  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => dispatch({ type: "motion/os", payload: { reducedMotion: query.matches } });
    sync();
    query.addEventListener?.("change", sync);
    return () => query.removeEventListener?.("change", sync);
  }, []);

  const liveEnabled = state.input.enabled;
  useEffect(() => {
    if (state.playing && liveEnabled) evaluatorRef.current.reset(unwrappedRef.current);
  }, [state.playing, liveEnabled]);

  useEffect(() => {
    if (!state.playing) return undefined;
    previousTimeRef.current = null;
    const frame = (timestamp) => {
      if (previousTimeRef.current !== null) {
        const deltaMs = Math.max(0, Math.min(timestamp - previousTimeRef.current, 250));
        const fromMs = elapsedRef.current;
        unwrappedRef.current += deltaMs;
        if (stateRef.current.input.enabled) evaluatorRef.current.advance(unwrappedRef.current).forEach(handleVerdict);
        else crossedEvents(fromMs, deltaMs, DEMO_SONG).forEach(dispatchSimulatedEvent);
        const elapsedMs = nextExcerptTime(fromMs, deltaMs, DEMO_SONG.excerpt);
        elapsedRef.current = elapsedMs;
        // Keep event timing precise; publish the visual clock in discrete steps.
        visualDeltaRef.current += deltaMs;
        const reduceMotion = stateRef.current.effects.reducedMotion || stateRef.current.osReducedMotion;
        if (!reduceMotion || visualDeltaRef.current >= REDUCED_MOTION_STEP_MS) {
          visualDeltaRef.current = reduceMotion ? visualDeltaRef.current % REDUCED_MOTION_STEP_MS : 0;
          dispatch({ type: "clock/tick", payload: { elapsedMs } });
        }
      }
      previousTimeRef.current = timestamp;
      lastFrameRef.current = { timestamp, unwrappedMs: unwrappedRef.current };
      frameRef.current = requestAnimationFrame(frame);
    };
    frameRef.current = requestAnimationFrame(frame);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      previousTimeRef.current = null;
    };
  }, [dispatchSimulatedEvent, handleVerdict, state.playing]);

  useEffect(() => () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    timeoutsRef.current.forEach((timeout) => window.clearTimeout(timeout));
    timeoutsRef.current.clear();
  }, []);

  return { state, dispatch, triggerScoreDemo, handleStrum };
}
