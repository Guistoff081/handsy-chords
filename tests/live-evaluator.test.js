import { describe, expect, it } from "vitest";
import { CLOSE_AFTER_MS, createEvaluator, HIT_WINDOW_MS, LATE_WINDOW_MS } from "../src/practice/liveEvaluator.js";

const song = {
  excerpt: { startMs: 1_000, endMs: 3_000 },
  events: [
    { atMs: 1_500, kind: "chord", chord: "Em" },
    { atMs: 1_800, kind: "note", string: 2 },
    { atMs: 2_500, kind: "chord", chord: "G" },
  ],
};

describe("live evaluator", () => {
  it("scores an on-time matching strum as a hit and an off-beat one as late", () => {
    const evaluator = createEvaluator(song);
    expect(evaluator.strum({ timeMs: 1_500 + HIT_WINDOW_MS, chord: "Em" })).toMatchObject({ kind: "hit", timingMs: HIT_WINDOW_MS });
    expect(evaluator.strum({ timeMs: 2_500 - 300, chord: "G" })).toMatchObject({ kind: "late", timingMs: -300 });
  });

  it("flags the wrong chord without consuming extra events", () => {
    const evaluator = createEvaluator(song);
    expect(evaluator.strum({ timeMs: 1_520, chord: "G" })).toMatchObject({ kind: "wrong", expected: "Em", heard: "G" });
    expect(evaluator.strum({ timeMs: 1_530, chord: "Em" })).toBeNull();
  });

  it("ignores strums outside every window and notes are never evaluated", () => {
    const evaluator = createEvaluator(song);
    expect(evaluator.strum({ timeMs: 1_500 + LATE_WINDOW_MS + 1, chord: "Em" })).toBeNull();
    // The note at 1_800 never opens a window of its own: this strum is judged against the Em chord event.
    expect(evaluator.strum({ timeMs: 1_800, chord: "Em" })).toMatchObject({ kind: "late", expected: "Em", timingMs: 300 });
  });

  it("turns an unanswered event into a miss exactly once", () => {
    const evaluator = createEvaluator(song);
    expect(evaluator.advance(1_500 + CLOSE_AFTER_MS)).toEqual([]);
    expect(evaluator.advance(1_500 + CLOSE_AFTER_MS + 1)).toEqual([{ kind: "miss", expected: "Em", heard: null, timingMs: 0 }]);
    expect(evaluator.advance(1_500 + CLOSE_AFTER_MS + 50)).toEqual([]);
  });

  it("waits long enough for a late strum to be recognised before calling the event missed", () => {
    const evaluator = createEvaluator(song);
    // Attack 380 ms after the event; its chord is only named ~350 ms later, when the clock is already past the strum window.
    expect(evaluator.advance(1_500 + LATE_WINDOW_MS + 350)).toEqual([]);
    expect(evaluator.strum({ timeMs: 1_500 + 380, chord: "Em" })).toMatchObject({ kind: "late", timingMs: 380 });
  });

  it("does not miss an event that was already answered", () => {
    const evaluator = createEvaluator(song);
    evaluator.strum({ timeMs: 1_500, chord: "Em" });
    expect(evaluator.advance(2_000)).toEqual([]);
  });

  it("keeps working across loops of the excerpt", () => {
    const evaluator = createEvaluator(song);
    const loopTwo = 1_500 + 2_000;
    expect(evaluator.strum({ timeMs: loopTwo + 20, chord: "Em" })).toMatchObject({ kind: "hit" });
    expect(evaluator.advance(loopTwo + 1_200).map((m) => m.expected)).toEqual([]);
    expect(evaluator.advance(2_500 + 2_000 + CLOSE_AFTER_MS + 1).map((m) => m.expected)).toEqual(["G"]);
  });
});

describe("live evaluator start", () => {
  it("ignores events that were already behind the moment evaluation started", () => {
    const evaluator = createEvaluator(song);
    evaluator.reset(2_000);
    expect(evaluator.advance(2_000 + CLOSE_AFTER_MS + 1)).toEqual([]);
    expect(evaluator.advance(2_500 + CLOSE_AFTER_MS + 1).map((m) => m.expected)).toEqual(["G"]);
  });
});
