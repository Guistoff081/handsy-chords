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

  it("tracks live input: toggling asks for the microphone and a refusal turns it back off", () => {
    const asked = practiceReducer(createPracticeState(), { type: "input/toggle" });
    expect(asked.input).toMatchObject({ enabled: true, status: "requesting" });
    const listening = practiceReducer(asked, { type: "input/status", payload: { status: "listening" } });
    expect(listening.input).toMatchObject({ enabled: true, status: "listening" });
    const denied = practiceReducer(asked, { type: "input/status", payload: { status: "denied" } });
    expect(denied.input).toMatchObject({ enabled: false, status: "denied" });
    const off = practiceReducer(listening, { type: "input/toggle" });
    expect(off.input).toMatchObject({ enabled: false, status: "off", heard: null });
  });

  it("starts a live session from zero and restores the demo scoreboard afterwards", () => {
    const live = practiceReducer(createPracticeState(), { type: "input/toggle" });
    expect(live).toMatchObject({ score: 0, streak: 0, multiplier: 1, feedback: "TOQUE O ACORDE DA PISTA" });
    const back = practiceReducer(live, { type: "input/toggle" });
    expect(back).toMatchObject({ score: 24_680, streak: 12, multiplier: 4 });
  });

  it("labels an early strum as early and keeps a custom miss message", () => {
    const early = practiceReducer(createPracticeState(), { type: "practice/late", payload: { timingMs: -200 } });
    expect(early.feedback).toBe("UM POUCO CEDO");
    const wrong = practiceReducer(createPracticeState(), { type: "practice/miss", payload: { feedback: "OUVI G · TOQUE Em" } });
    expect(wrong).toMatchObject({ feedback: "OUVI G · TOQUE Em", streak: 0, multiplier: 1 });
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
