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
    for (let timestamp = 250; timestamp <= 35_500; timestamp += 250) {
      act(() => animationFrame(timestamp));
    }

    expect(result.current.state).toMatchObject({ elapsedMs: 77_500, streak: 24, multiplier: 4, feedback: "NO TEMPO · SOOU LIMPO" });

    for (let timestamp = 35_750; timestamp <= 40_750; timestamp += 250) {
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
