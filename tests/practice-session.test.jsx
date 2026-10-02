import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePracticeSession } from "../src/practice/usePracticeSession.js";

function installAnimationFrames() {
  const frames = new Map();
  let frameId = 0;
  vi.stubGlobal("requestAnimationFrame", (callback) => {
    frames.set(++frameId, callback);
    return frameId;
  });
  vi.stubGlobal("cancelAnimationFrame", (id) => frames.delete(id));

  return {
    advance(timestamp) {
      act(() => {
        const callbacks = [...frames.values()];
        frames.clear();
        callbacks.forEach((callback) => callback(timestamp));
      });
    },
    pending() {
      return frames.size;
    },
  };
}

function installMotionPreference(matches) {
  let changeListener;
  const query = {
    matches,
    addEventListener(event, listener) {
      if (event === "change") changeListener = listener;
    },
    removeEventListener(event, listener) {
      if (event === "change" && changeListener === listener) changeListener = undefined;
    },
  };
  vi.stubGlobal("matchMedia", vi.fn(() => query));

  return {
    change(nextMatches) {
      query.matches = nextMatches;
      changeListener?.({ matches: nextMatches });
    },
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("usePracticeSession", () => {
  it("primes and completes the deterministic multiplier demonstration", () => {
    vi.useFakeTimers();
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const { result } = renderHook(() => usePracticeSession());

    act(() => result.current.triggerScoreDemo());

    expect(result.current.state).toMatchObject({
      score: 24_880,
      streak: 24,
      multiplier: 4,
      celebrating: true,
    });

    act(() => vi.advanceTimersByTime(700));
    expect(result.current.state.celebrating).toBe(false);
  });

  it("raises the multiplier through playback before the scheduled simulated miss", () => {
    vi.useFakeTimers();
    let animationFrame;
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback) => {
      animationFrame = callback;
      return 1;
    }));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const { result } = renderHook(() => usePracticeSession());

    act(() => result.current.dispatch({ type: "playback/toggle" }));
    act(() => animationFrame(0));
    // 25 simulated events: the first is the scheduled miss, the next 24 are hits; the 25th chord/note event sits at 74_650 in the fourth pass.
    for (let timestamp = 250; timestamp <= 24_750; timestamp += 250) {
      act(() => animationFrame(timestamp));
    }

    expect(result.current.state).toMatchObject({ elapsedMs: 74_750, streak: 24, multiplier: 4, feedback: "NO TEMPO · SOOU LIMPO" });

    for (let timestamp = 25_000; timestamp <= 25_500; timestamp += 250) {
      act(() => animationFrame(timestamp));
    }
    expect(result.current.state).toMatchObject({ streak: 0, multiplier: 1, feedback: "AJUSTE O TEMPO" });
  });

  it("steps the real session clock under manual reduced motion without losing events, looping, pause, or cleanup", () => {
    const animation = installAnimationFrames();
    const { result, unmount } = renderHook(() => usePracticeSession());

    act(() => result.current.dispatch({ type: "effect/toggle", payload: { effect: "reducedMotion" } }));
    act(() => result.current.dispatch({ type: "playback/toggle" }));
    animation.advance(0);
    animation.advance(100);
    animation.advance(250);
    animation.advance(499);

    expect(result.current.state.elapsedMs).toBe(74_000);

    animation.advance(500);
    expect(result.current.state.elapsedMs).toBe(74_500);

    animation.advance(650);
    expect(result.current.state).toMatchObject({
      elapsedMs: 74_500,
      score: 24_655,
      feedback: "AJUSTE O TEMPO",
    });

    for (let timestamp = 750; timestamp <= 6_500; timestamp += 250) animation.advance(timestamp);
    expect(result.current.state.elapsedMs).toBe(72_500);

    act(() => result.current.dispatch({ type: "playback/toggle" }));
    expect(animation.pending()).toBe(0);
    act(() => result.current.dispatch({ type: "playback/toggle" }));
    animation.advance(10_000);
    animation.advance(10_100);
    expect(result.current.state.elapsedMs).toBe(72_500);

    act(() => result.current.dispatch({ type: "effect/toggle", payload: { effect: "reducedMotion" } }));
    expect(result.current.state.elapsedMs).toBe(72_600);
    animation.advance(10_116);
    expect(result.current.state.elapsedMs).toBe(72_616);

    unmount();
    expect(animation.pending()).toBe(0);
  });

  it("uses the same stepped clock for the OS reduced-motion preference and returns to continuous time", () => {
    const animation = installAnimationFrames();
    const motionPreference = installMotionPreference(true);
    const { result } = renderHook(() => usePracticeSession());

    expect(result.current.state.osReducedMotion).toBe(true);
    act(() => result.current.dispatch({ type: "playback/toggle" }));
    animation.advance(0);
    animation.advance(100);
    animation.advance(250);
    expect(result.current.state.elapsedMs).toBe(74_000);
    animation.advance(500);
    expect(result.current.state.elapsedMs).toBe(74_500);

    act(() => motionPreference.change(false));
    animation.advance(516);
    expect(result.current.state.elapsedMs).toBe(74_516);
  });
});

describe("usePracticeSession with live input", () => {
  function startLive() {
    const animation = installAnimationFrames();
    const hook = renderHook(() => usePracticeSession());
    act(() => hook.result.current.dispatch({ type: "input/toggle" }));
    act(() => hook.result.current.dispatch({ type: "input/status", payload: { status: "listening" } }));
    act(() => hook.result.current.dispatch({ type: "playback/toggle" }));
    animation.advance(0);
    return { ...hook, animation };
  }
  const strum = (result, overrides) => act(() => result.current.handleStrum({ perf: 2_040, chord: "Em", confidence: 0.9, ...overrides }));

  it("judges a matching strum against the Em event at 76 s as a hit and shows what was heard", () => {
    const { result, animation } = startLive();
    for (let t = 250; t <= 2_000; t += 250) animation.advance(t);
    strum(result);
    expect(result.current.state).toMatchObject({ streak: 1, score: 100, feedback: "NO TEMPO · SOOU LIMPO", timingMs: 40 });
    expect(result.current.state.input.heard).toEqual({ chord: "Em", confidence: 0.9 });
  });

  it("calls out the wrong chord and resets the streak", () => {
    const { result, animation } = startLive();
    for (let t = 250; t <= 2_000; t += 250) animation.advance(t);
    strum(result, { chord: "G" });
    expect(result.current.state).toMatchObject({ streak: 0, multiplier: 1, feedback: "OUVI G · TOQUE Em" });
  });

  it("turns an unanswered chord event into a miss once its window closes", () => {
    const { result, animation } = startLive();
    for (let t = 250; t <= 3_000; t += 250) animation.advance(t);
    expect(result.current.state).toMatchObject({ streak: 0, feedback: "FALTOU O Em" });
  });

  it("does not run the scripted simulation while live input is on", () => {
    const { result, animation } = startLive();
    for (let t = 250; t <= 1_500; t += 250) animation.advance(t);
    expect(result.current.state).toMatchObject({ streak: 0, score: 0, feedback: "TOQUE O ACORDE DA PISTA" });
  });

  it("records an unclear strum as heard but never judges it", () => {
    const { result, animation } = startLive();
    for (let t = 250; t <= 2_000; t += 250) animation.advance(t);
    strum(result, { confidence: 0.3 });
    expect(result.current.state.streak).toBe(0);
    expect(result.current.state.score).toBe(0);
    expect(result.current.state.input.heard.confidence).toBe(0.3);
  });

  it("only shows what was heard when playback is paused", () => {
    const animation = installAnimationFrames();
    const { result } = renderHook(() => usePracticeSession());
    act(() => result.current.dispatch({ type: "input/toggle" }));
    animation.advance(0);
    strum(result);
    expect(result.current.state.streak).toBe(0);
    expect(result.current.state.input.heard.chord).toBe("Em");
  });

  it("resumes the simulation when the microphone is refused", () => {
    const { result, animation } = startLive();
    act(() => result.current.dispatch({ type: "input/status", payload: { status: "denied" } }));
    expect(result.current.state.input).toMatchObject({ enabled: false, status: "denied" });
    expect(result.current.state).toMatchObject({ score: 24_680, streak: 12, multiplier: 4 });
    for (let t = 250; t <= 1_500; t += 250) animation.advance(t);
    // The scripted cycle starts with its scheduled miss, then hits: streak 0 -> 1.
    expect(result.current.state.streak).toBe(1);
  });
});
