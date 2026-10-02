import { beforeEach, describe, expect, it, vi } from "vitest";
import { getChord } from "../src/data/chords.js";
import { createCoachEngine } from "../src/vision/coachEngine.js";
import { cellPoint, pressCoordinate, toImage } from "../src/vision/fretboard.js";
import { judgeFinger, summarize, targetFingers } from "../src/vision/fingerCheck.js";

const TRUTH = { a: 21, b: -520, c: 400, d: 6, e: 770, f: 120 };
const SIZE = { width: 1280, height: 720 };

let seed;
const jitter = (amount = 1.5) => { seed = (seed * 1_664_525 + 1_013_904_223) % 4_294_967_296; return (seed / 4_294_967_296 - 0.5) * 2 * amount; };

/** A frame with the given fingertips on [string, fret] cells (fret may be fractional to simulate drift). */
function frame(cells, { pressed, present = true, noise = 1.5 } = {}) {
  const tips = {};
  for (const [finger, [string, fret]] of Object.entries(cells)) {
    const point = toImage(TRUTH, string, pressCoordinate(fret));
    tips[finger] = { x: point.x + jitter(noise), y: point.y + jitter(noise) };
  }
  return { present, pressed: pressed ?? Object.keys(cells).map(Number), tips, size: SIZE };
}

const G_CELLS = { 2: [0, 3], 1: [1, 2], 3: [5, 3] };
const EM_CELLS = { 2: [1, 2], 3: [2, 2] };

function calibrated(chord = "Em") {
  const clock = { t: 0 };
  const engine = createCoachEngine({ chord, now: () => clock.t });
  engine.startCalibration();
  for (let i = 0; i < 18; i += 1) engine.process(frame(G_CELLS));
  return { engine, clock };
}

const settle = (engine, make, frames = 6) => { for (let i = 0; i < frames; i += 1) engine.process(make()); return engine.snapshot(); };

beforeEach(() => { seed = 7; });

describe("calibration", () => {
  it("learns the neck from a steady G and reports progress on the way", () => {
    const engine = createCoachEngine({ chord: "Em", now: () => 0 });
    expect(engine.snapshot()).toMatchObject({ calibrated: false, calibration: { status: "none" } });
    engine.startCalibration();
    expect(engine.snapshot().calibration.status).toBe("collecting");
    for (let i = 0; i < 9; i += 1) engine.process(frame(G_CELLS));
    expect(engine.snapshot().calibration.progress).toBeCloseTo(0.5, 1);
    for (let i = 0; i < 9; i += 1) engine.process(frame(G_CELLS));
    expect(engine.snapshot()).toMatchObject({ calibrated: true, calibration: { status: "ready" } });
  });

  it("does not progress while the hand shakes, and resets the count", () => {
    const engine = createCoachEngine({ now: () => 0 });
    engine.startCalibration();
    for (let i = 0; i < 40; i += 1) engine.process(frame(G_CELLS, { noise: 30 }));
    expect(engine.snapshot()).toMatchObject({ calibrated: false, calibration: { status: "collecting", progress: 0 } });
  });

  it("uses the raw bend angles when given: a slightly bent finger is enough to calibrate, a straight one is not", () => {
    const bentFrame = (angle) => ({ ...frame(G_CELLS, { pressed: [] }), angles: { 1: angle, 2: angle, 3: angle, 4: 175 } });
    const lenient = createCoachEngine({ now: () => 0 });
    lenient.startCalibration();
    for (let i = 0; i < 18; i += 1) lenient.process(bentFrame(155));
    expect(lenient.snapshot().calibrated).toBe(true);
    const straight = createCoachEngine({ now: () => 0 });
    straight.startCalibration();
    for (let i = 0; i < 18; i += 1) straight.process(bentFrame(172));
    expect(straight.snapshot()).toMatchObject({ calibrated: false, calibration: { progress: 0 } });
  });

  it("waits for all three fingers to be pressing", () => {
    const engine = createCoachEngine({ now: () => 0 });
    engine.startCalibration();
    for (let i = 0; i < 40; i += 1) engine.process(frame(G_CELLS, { pressed: [1, 2] }));
    expect(engine.snapshot().calibration.progress).toBe(0);
  });

  it("gives up after 15 seconds and says what to do", () => {
    const clock = { t: 0 };
    const engine = createCoachEngine({ now: () => clock.t });
    engine.startCalibration();
    clock.t = 15_001;
    engine.process(frame(G_CELLS, { pressed: [] }));
    expect(engine.snapshot().calibration).toMatchObject({ status: "failed", message: expect.stringContaining("Não vi o G parado") });
  });

  it("rejects a reading that cannot be a fretboard", () => {
    const engine = createCoachEngine({ now: () => 0 });
    engine.startCalibration();
    const tiny = { present: true, pressed: [1, 2, 3], size: SIZE, tips: { 1: { x: 600, y: 300 }, 2: { x: 603, y: 301 }, 3: { x: 606, y: 299 } } };
    for (let i = 0; i < 18; i += 1) engine.process(tiny);
    expect(engine.snapshot().calibration.status).toBe("failed");
  });

  it("can be cancelled, keeping an earlier calibration, and cleared", () => {
    const { engine } = calibrated();
    engine.startCalibration();
    engine.cancelCalibration();
    expect(engine.snapshot().calibration.status).toBe("ready");
    engine.clearCalibration();
    expect(engine.snapshot()).toMatchObject({ calibrated: false, calibration: { status: "none" }, fingers: [] });
  });
});

describe("finger feedback after calibration", () => {
  it("confirms a correct Em with noisy fingertips", () => {
    const { engine } = calibrated("Em");
    const result = settle(engine, () => frame(EM_CELLS));
    expect(result.fingers.map((f) => f.status)).toEqual(["ok", "ok"]);
    expect(result.summary).toBe("CASAS E CORDAS CERTAS");
    expect(result.fingers[1].message).toBe("Dedo 3 · corda D, casa 2");
  });

  it("names the string a finger is on and which way to move it", () => {
    const { engine } = calibrated("Em");
    const result = settle(engine, () => frame({ 2: [1, 2], 3: [3, 2] }));
    expect(result.fingers[1]).toMatchObject({ status: "wrong-string" });
    expect(result.fingers[1].message).toBe("Dedo 3 · está em G2. Leve para a corda D (mais grave)");
    expect(result.summary).toBe("DEDO 3 · ESTÁ EM G2. LEVE PARA A CORDA D (MAIS GRAVE)");
  });

  it("tells whether to move towards the head or the body when the fret is wrong", () => {
    const { engine } = calibrated("Em");
    expect(settle(engine, () => frame({ 2: [1, 2], 3: [2, 3] })).fingers[1].message).toBe("Dedo 3 · está em D3. Recue para a casa 2 (mais perto da cabeça)");
    expect(settle(engine, () => frame({ 2: [1, 2], 3: [2, 1] })).fingers[1].message).toBe("Dedo 3 · está em D1. Avance para a casa 2 (mais perto do corpo)");
  });

  it("combines a wrong string and a wrong fret in one instruction", () => {
    const { engine } = calibrated("Em");
    const row = settle(engine, () => frame({ 2: [1, 2], 3: [4, 3] })).fingers[1];
    expect(row.status).toBe("wrong-cell");
    expect(row.message).toContain("está em B3");
    expect(row.message).toContain("corda D");
    expect(row.message).toContain("casa 2");
  });

  it("coaches the position inside the right fret: closer to the wire, or just off it", () => {
    const { engine } = calibrated("Em");
    const far = settle(engine, () => frame({ 2: [1, 2], 3: [2, 1.57] }), 8).fingers[1];
    expect(far).toMatchObject({ status: "far-from-fret", message: "Dedo 3 · casa 2 certa. Chegue mais perto do traste" });
    const on = settle(engine, () => frame({ 2: [1, 2], 3: [2, 2.45] }), 8).fingers[1];
    expect(on.status).toBe("on-fret");
  });

  it("says a finger is lifted when it is not pressing", () => {
    const { engine } = calibrated("Em");
    const result = settle(engine, () => frame(EM_CELLS, { pressed: [2] }));
    expect(result.fingers[1]).toMatchObject({ status: "lifted", message: "Dedo 3 · levantado. Pressione a corda D, casa 2" });
  });

  it("does not flicker: one bad frame is ignored, a lasting change is adopted", () => {
    const { engine } = calibrated("Em");
    settle(engine, () => frame(EM_CELLS));
    engine.process(frame({ 2: [1, 2], 3: [3, 2] }));
    expect(engine.snapshot().fingers[1].status).toBe("ok");
    for (let i = 0; i < 4; i += 1) engine.process(frame({ 2: [1, 2], 3: [3, 2] }));
    expect(engine.snapshot().fingers[1].status).toBe("wrong-string");
  });

  it("follows the chord of the song, judging the fingers that chord needs", () => {
    const { engine } = calibrated("Em");
    engine.setChord("G");
    const result = settle(engine, () => frame(G_CELLS));
    expect(result.fingers.map((f) => f.finger)).toEqual([1, 2, 3]);
    expect(result.fingers.every((f) => f.status === "ok")).toBe(true);
  });

  it("notices when the hand leaves the picture", () => {
    const { engine } = calibrated("Em");
    settle(engine, () => frame(EM_CELLS));
    engine.process({ present: false, pressed: [], tips: {}, size: SIZE });
    expect(engine.snapshot().fingers[0].message).toBe("Dedo 2 · mão fora da imagem");
  });

  it("gives no cell feedback before calibration", () => {
    const engine = createCoachEngine({ chord: "Em" });
    engine.process(frame(EM_CELLS));
    expect(engine.snapshot()).toMatchObject({ fingers: [], summary: "" });
  });
});

describe("overlay", () => {
  function recorder() {
    const calls = { moves: 0, arcs: [], styles: [] };
    return {
      calls,
      save() {}, restore() {}, setLineDash() {},
      beginPath() {}, moveTo() { calls.moves += 1; }, lineTo() {}, stroke() { calls.styles.push(this.strokeStyle); },
      arc(x, y, r) { calls.arcs.push({ x, y, r }); },
    };
  }

  it("draws nothing before calibration", () => {
    const context = recorder();
    createCoachEngine().draw(context, 0);
    expect(context.calls.moves).toBe(0);
  });

  it("draws six strings, seven fret wires and a ring on each target cell, magenta where a finger is off", () => {
    const { engine } = calibrated("Em");
    settle(engine, () => frame({ 2: [1, 2], 3: [3, 2] }));
    const context = recorder();
    engine.draw(context, 0);
    expect(context.calls.moves).toBeGreaterThanOrEqual(6 + 7);
    expect(context.calls.styles).toContain("#e24a8d");
    const goal = cellPoint(TRUTH, 1, 2);
    expect(context.calls.arcs.some(({ x, y }) => Math.hypot(x - goal.x, y - goal.y) < 3)).toBe(true);
  });

  it("pulses the ring of the wrong finger over time", () => {
    const { engine } = calibrated("Em");
    settle(engine, () => frame({ 2: [1, 2], 3: [3, 2] }));
    const radii = [0, 220].map((time) => { const c = recorder(); engine.draw(c, time); return c.calls.arcs.at(-1).r; });
    expect(radii[0]).not.toBeCloseTo(radii[1], 1);
  });
});

describe("finger check", () => {
  it("lists the cells a chord needs by finger", () => {
    expect(targetFingers(getChord("Em"))).toEqual([{ finger: 2, string: 1, fret: 2 }, { finger: 3, string: 2, fret: 2 }]);
    expect(targetFingers(getChord("G")).map((t) => [t.finger, t.string, t.fret])).toEqual([[1, 1, 2], [2, 0, 3], [3, 5, 3]]);
  });

  it("summarises nothing for an empty list", () => {
    expect(summarize([])).toBe("");
  });

  it("falls back to lifted when the neck map cannot place the tip", () => {
    const row = judgeFinger({ target: { finger: 2, string: 1, fret: 2 }, tip: { x: 1, y: 1 }, pressed: true, matrix: { a: 1, b: 2, c: 0, d: 2, e: 4, f: 0 } });
    expect(row.status).toBe("lifted");
  });
});
