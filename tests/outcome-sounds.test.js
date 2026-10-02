import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const unlocked = vi.hoisted(() => ({ context: null }));
vi.mock("../src/audio/lightningSound.js", () => ({ runningAudioContext: () => unlocked.context }));

import { playOutcomeSound } from "../src/audio/outcomeSounds.js";

function fakeContext() {
  const made = { oscillators: [], sources: [], filters: [], gains: [] };
  const param = () => ({ setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() });
  const node = (extra = {}) => ({ connect: vi.fn(function connect(target) { return target; }), disconnect: vi.fn(), ...extra });
  return {
    made,
    currentTime: 2,
    sampleRate: 1_000,
    destination: node(),
    createOscillator() { const o = node({ type: "", frequency: param(), start: vi.fn(), stop: vi.fn() }); made.oscillators.push(o); return o; },
    createGain() { const g = node({ gain: param() }); made.gains.push(g); return g; },
    createBiquadFilter() { const f = node({ type: "", frequency: param(), Q: param() }); made.filters.push(f); return f; },
    createBuffer: (_c, length) => ({ getChannelData: () => new Float32Array(length) }),
    createBufferSource() { const s = node({ start: vi.fn(), stop: vi.fn() }); made.sources.push(s); return s; },
  };
}

beforeEach(() => { vi.useFakeTimers(); unlocked.context = fakeContext(); });
afterEach(() => { vi.useRealTimers(); });

describe("outcome sounds", () => {
  it("stays silent until sound has been unlocked and ignores unknown verdicts", () => {
    unlocked.context = null;
    expect(playOutcomeSound("hit")).toBe(false);
    unlocked.context = fakeContext();
    expect(playOutcomeSound("nope")).toBe(false);
    expect(unlocked.context.made.oscillators).toHaveLength(0);
  });

  it("plays a bright two-note tick for a hit and one softer tone for a late strum", () => {
    expect(playOutcomeSound("hit")).toBe(true);
    expect(unlocked.context.made.oscillators).toHaveLength(2);
    unlocked.context = fakeContext();
    expect(playOutcomeSound("late")).toBe(true);
    expect(unlocked.context.made.oscillators).toHaveLength(1);
  });

  it("plays a low thud with noise for a miss, and a thud with a detuned pair for a wrong chord", () => {
    playOutcomeSound("miss");
    expect(unlocked.context.made.oscillators).toHaveLength(1);
    expect(unlocked.context.made.sources).toHaveLength(1);
    unlocked.context = fakeContext();
    playOutcomeSound("wrong");
    expect(unlocked.context.made.oscillators).toHaveLength(3);
    const types = unlocked.context.made.oscillators.map((o) => o.type);
    expect(types.filter((t) => t === "sawtooth")).toHaveLength(2);
  });

  it("adds the boo only to failures and only when it was asked for", () => {
    playOutcomeSound("miss");
    const without = unlocked.context.made.oscillators.length;
    unlocked.context = fakeContext();
    playOutcomeSound("miss", { boo: true });
    expect(unlocked.context.made.oscillators.length).toBe(without + 2);
    expect(unlocked.context.made.filters.map((f) => f.type)).toEqual(["lowpass", "bandpass", "bandpass"]);
    unlocked.context = fakeContext();
    playOutcomeSound("hit", { boo: true });
    expect(unlocked.context.made.oscillators).toHaveLength(2);
  });

  it("disconnects every node once the cue has finished", () => {
    playOutcomeSound("wrong", { boo: true });
    const nodes = [...unlocked.context.made.oscillators, ...unlocked.context.made.gains, ...unlocked.context.made.filters];
    vi.advanceTimersByTime(1_400);
    nodes.forEach((n) => expect(n.disconnect).toHaveBeenCalled());
  });

  it("reports failure instead of throwing when synthesis breaks", () => {
    unlocked.context.createOscillator = () => { throw new Error("boom"); };
    expect(playOutcomeSound("hit")).toBe(false);
  });
});
