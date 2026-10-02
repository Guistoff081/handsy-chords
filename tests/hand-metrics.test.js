import { describe, expect, it } from "vitest";
import { getChord } from "../src/data/chords.js";
import { compareFingers, describeComparison, fingerAngles, fingersForChord, jointAngle, pressedFingers } from "../src/vision/handMetrics.js";
import { makeHand } from "./helpers/hand.js";

describe("hand metrics", () => {
  it("measures a straight line as 180 degrees and a right angle as 90", () => {
    expect(jointAngle({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 })).toBeCloseTo(180, 5);
    expect(jointAngle({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 })).toBeCloseTo(90, 5);
    expect(jointAngle({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 1 })).toBe(180);
  });

  it("reads the bend of each finger from its PIP joint, in 3D", () => {
    const angles = fingerAngles(makeHand({ bent: [2, 3], bendDegrees: 100 }));
    expect(angles[1]).toBeCloseTo(180, 3);
    expect(angles[2]).toBeCloseTo(100, 3);
    expect(angles[3]).toBeCloseTo(100, 3);
    expect(angles[4]).toBeCloseTo(180, 3);
  });

  it("names the fingers pressing the neck", () => {
    expect(pressedFingers(makeHand({ bent: [2, 3] }))).toEqual([2, 3]);
    expect(pressedFingers(makeHand({ bent: [] }))).toEqual([]);
    expect(pressedFingers(makeHand({ bent: [1, 2, 3, 4] }))).toEqual([1, 2, 3, 4]);
  });

  it("treats a barely curved, relaxed finger as not pressing", () => {
    expect(pressedFingers(makeHand({ bent: [1], bendDegrees: 155 }))).toEqual([]);
    expect(pressedFingers(makeHand({ bent: [1], bendDegrees: 125 }))).toEqual([1]);
  });

  it("derives the fingers a chord needs from its canonical shape", () => {
    expect(fingersForChord(getChord("Em"))).toEqual([2, 3]);
    expect(fingersForChord(getChord("G"))).toEqual([1, 2, 3]);
  });

  it("compares pressed fingers with the chord and words the result", () => {
    const expected = [2, 3];
    expect(describeComparison(compareFingers([2, 3], expected))).toBe("DEDOS CERTOS · 2 E 3 FIRMES");
    expect(describeComparison(compareFingers([2], expected))).toBe("FALTA O DEDO 3");
    expect(describeComparison(compareFingers([], [1, 2, 3]))).toBe("FALTAM OS DEDOS 1, 2 E 3");
    expect(describeComparison(compareFingers([1, 2, 3], expected))).toBe("DEDO 1 SOBRANDO");
    expect(describeComparison(compareFingers([1, 2, 3, 4], expected))).toBe("DEDOS 1 E 4 SOBRANDO");
    expect(compareFingers([3], expected)).toMatchObject({ status: "missing", missing: [2], extra: [] });
  });

  it("reports a missing finger before a surplus one", () => {
    expect(compareFingers([1, 3], [2, 3]).status).toBe("missing");
  });
});
