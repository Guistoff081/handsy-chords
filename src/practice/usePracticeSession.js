import { useCallback, useEffect, useReducer, useRef } from "react";
import { DEMO_SONG } from "../data/demoSong.js";
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

  const dispatchSimulatedEvent = useCallback(() => {
    const cycleIndex = simulationEventRef.current % DEMO_SONG.simulation.cycleEvents;
    simulationEventRef.current += 1;
    if (cycleIndex === DEMO_SONG.simulation.missAt) {
      dispatch({ type: "practice/miss" });
      return;
    }
    if (cycleIndex === DEMO_SONG.simulation.lateAt) {
      dispatch({ type: "practice/late", payload: { timingMs: 96 } });
      if (multiplierForStreak(stateRef.current.streak + 1) > stateRef.current.multiplier) scheduleCelebrationEnd();
      return;
    }
    dispatch({ type: "practice/hit", payload: { timingMs: 18 } });
    if (multiplierForStreak(stateRef.current.streak + 1) > stateRef.current.multiplier) scheduleCelebrationEnd();
  }, [scheduleCelebrationEnd]);

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

  useEffect(() => {
    if (!state.playing) return undefined;
    previousTimeRef.current = null;
    const frame = (timestamp) => {
      if (previousTimeRef.current !== null) {
        const deltaMs = Math.max(0, Math.min(timestamp - previousTimeRef.current, 250));
        const fromMs = elapsedRef.current;
        crossedEvents(fromMs, deltaMs, DEMO_SONG).forEach(dispatchSimulatedEvent);
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
      frameRef.current = requestAnimationFrame(frame);
    };
    frameRef.current = requestAnimationFrame(frame);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      previousTimeRef.current = null;
    };
  }, [dispatchSimulatedEvent, state.playing]);

  useEffect(() => () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    timeoutsRef.current.forEach((timeout) => window.clearTimeout(timeout));
    timeoutsRef.current.clear();
  }, []);

  return { state, dispatch, triggerScoreDemo };
}
