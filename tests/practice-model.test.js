import { describe, expect, it } from "vitest";
import {
  createPracticeState,
  multiplierForStreak,
  practiceReducer,
} from "../src/practice/model.js";

describe("practice model", () => {
  it("starts paused in learning mode with the track hidden", () => {
    expect(createPracticeState()).toMatchObject({
      playing: false,
      mode: "learn",
      layers: { track: false, lyrics: true, hand: true },
      effects: { smoke: true, lightning: true, sound: false, reducedMotion: false },
      score: 24680,
      streak: 12,
      multiplier: 4,
    });
  });

  it.each([[0, 1], [7, 1], [8, 2], [23, 2], [24, 4]])(
    "maps streak %i to multiplier %i",
    (streak, multiplier) => expect(multiplierForStreak(streak)).toBe(multiplier),
  );

  it("toggles layers independently", () => {
    const state = practiceReducer(createPracticeState(), {
      type: "layer/toggle",
      payload: { layer: "lyrics" },
    });
    expect(state.layers).toEqual({ track: false, lyrics: false, hand: true });
  });

  it("applies the layer preset of each mode and keeps the mode when a layer is toggled", () => {
    const challenge = practiceReducer(createPracticeState(), { type: "mode/set", payload: { mode: "challenge" } });
    expect(challenge).toMatchObject({ mode: "challenge", layers: { track: true, lyrics: true, hand: false } });
    const tweaked = practiceReducer(challenge, { type: "layer/toggle", payload: { layer: "hand" } });
    expect(tweaked).toMatchObject({ mode: "challenge", layers: { track: true, lyrics: true, hand: true } });
    const back = practiceReducer(tweaked, { type: "mode/set", payload: { mode: "learn" } });
    expect(back.layers).toEqual({ track: false, lyrics: true, hand: true });
  });

  it("ignores unknown modes and ends any celebration when the mode changes", () => {
    const celebrating = { ...createPracticeState(), celebrating: true };
    expect(practiceReducer(celebrating, { type: "mode/set", payload: { mode: "nope" } })).toBe(celebrating);
    expect(practiceReducer(celebrating, { type: "mode/set", payload: { mode: "learn" } }).celebrating).toBe(false);
  });

  it("raises score and marks a multiplier celebration", () => {
    const initial = { ...createPracticeState(), streak: 23, multiplier: 2 };
    const state = practiceReducer(initial, {
      type: "practice/hit",
      payload: { timingMs: 18 },
    });
    expect(state).toMatchObject({ streak: 24, multiplier: 4, celebrating: true, timingMs: 18 });
    expect(state.score).toBeGreaterThan(initial.score);
  });

  it("resets streak on a miss without hiding guidance", () => {
    const state = practiceReducer(createPracticeState(), { type: "practice/miss" });
    expect(state).toMatchObject({ streak: 0, multiplier: 1, feedback: "AJUSTE O TEMPO" });
    expect(state.layers).toEqual(createPracticeState().layers);
  });

  it("records a late simulated event with deterministic feedback and score", () => {
    const initial = { ...createPracticeState(), score: 1_000, streak: 7, multiplier: 1 };
    const state = practiceReducer(initial, {
      type: "practice/late",
      payload: { timingMs: 96 },
    });

    expect(state).toMatchObject({
      score: 1_050,
      streak: 8,
      multiplier: 2,
      timingMs: 96,
      feedback: "UM POUCO TARDE",
      celebrating: true,
    });
  });
});
