import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePracticeSession } from "../src/practice/usePracticeSession.js";

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
});
