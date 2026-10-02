import { describe, expect, it } from "vitest";
import { cellPoint, checkFit, fitAffine, fretFromCoordinate, fretWire, locate, pressCoordinate, stringSpacing, toBoard, toImage } from "../src/vision/fretboard.js";

// A neck seen from the front and slightly rotated: strings 22 px apart, 1st fret step ~ 44 px.
const TRUTH = { a: 21, b: -520, c: 400, d: 6, e: 770, f: 120 };

describe("fretboard geometry", () => {
  it("spaces fret wires as in equal temperament", () => {
    expect(fretWire(0)).toBe(0);
    expect(fretWire(12)).toBeCloseTo(0.5, 10);
    expect(fretWire(1) - fretWire(0)).toBeGreaterThan(fretWire(6) - fretWire(5));
    expect(fretWire(2) - fretWire(1)).toBeCloseTo((fretWire(1) - fretWire(0)) / 2 ** (1 / 12), 10);
  });

  it("maps a pressed fret to its coordinate and back", () => {
    for (const fret of [1, 2, 3, 5, 7, 12]) expect(fretFromCoordinate(pressCoordinate(fret))).toBeCloseTo(fret, 10);
  });

  it("recovers an affine map exactly from three points", () => {
    const pairs = [[0, 3], [1, 2], [5, 3]].map(([s, fret]) => ({ s, q: pressCoordinate(fret), ...toImage(TRUTH, s, pressCoordinate(fret)) }));
    const fit = fitAffine(pairs);
    for (const key of Object.keys(TRUTH)) expect(fit[key]).toBeCloseTo(TRUTH[key], 6);
  });

  it("refuses collinear or too few points", () => {
    expect(fitAffine([{ s: 0, q: 0.1, x: 0, y: 0 }, { s: 1, q: 0.1, x: 1, y: 1 }])).toBeNull();
    const line = [0, 1, 2].map((s) => ({ s, q: 0.2, x: s * 10, y: 5 }));
    expect(fitAffine(line)).toBeNull();
  });

  it("inverts image points to string and fret and reports how far from the ideal spot", () => {
    const spot = cellPoint(TRUTH, 2, 2);
    expect(locate(TRUTH, spot)).toMatchObject({ string: 2, fret: 2 });
    expect(locate(TRUTH, spot).fretOffset).toBeCloseTo(0, 6);
    expect(toBoard(TRUTH, toImage(TRUTH, 3, 0.2))).toMatchObject({ s: expect.closeTo(3, 8), q: expect.closeTo(0.2, 8) });
    // Short of the ideal spot reads as a negative offset, past it (towards the wire) as positive.
    expect(locate(TRUTH, toImage(TRUTH, 2, pressCoordinate(1.6))).fretOffset).toBeCloseTo(-0.4, 6);
    expect(locate(TRUTH, toImage(TRUTH, 2, pressCoordinate(2.4))).fretOffset).toBeCloseTo(0.4, 6);
  });

  it("tells neighbouring strings and frets apart under a few pixels of noise", () => {
    let wrong = 0;
    let state = 11;
    const noise = () => { state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296; return (state / 4_294_967_296 - 0.5) * 2 * 3; };
    for (let string = 0; string < 6; string += 1) {
      for (let fret = 1; fret <= 5; fret += 1) {
        const p = cellPoint(TRUTH, string, fret);
        const found = locate(TRUTH, { x: p.x + noise(), y: p.y + noise() });
        if (found.string !== string || found.fret !== fret) wrong += 1;
      }
    }
    expect(wrong).toBe(0);
  });

  it("measures string spacing in pixels", () => {
    expect(stringSpacing(TRUTH)).toBeCloseTo(Math.hypot(21, 6), 10);
  });

  it("accepts a plausible neck and rejects impossible ones", () => {
    expect(checkFit(TRUTH, 1280)).toEqual({ ok: true });
    expect(checkFit({ ...TRUTH, a: 1, d: 0 }, 1280)).toEqual({ ok: false, reason: "tamanho" });
    expect(checkFit({ a: 21, b: 400, c: 0, d: 6, e: 120, f: 0 }, 1280).ok).toBe(false);
    // Strings and neck nearly parallel: the fit is a sliver, not a fretboard.
    expect(checkFit({ a: 20, b: 600, c: 0, d: 5, e: 150, f: 0 }, 1280)).toEqual({ ok: false, reason: "inclinação" });
  });
});
