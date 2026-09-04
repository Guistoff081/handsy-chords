import { describe, expect, it } from "vitest";
import { projectEvent } from "../src/canvas/highwayGeometry.js";

describe("highway projection", () => {
  const viewport = { width: 760, height: 700 };

  it("moves an approaching event toward the hit line", () => {
    const far = projectEvent(5_000, 0, viewport);
    const near = projectEvent(5_000, 4_000, viewport);
    expect(near.y).toBeGreaterThan(far.y);
    expect(near.scale).toBeGreaterThan(far.scale);
  });

  it("marks expired events as invisible", () => {
    expect(projectEvent(1_000, 2_000, viewport).visible).toBe(false);
  });

  it("places an on-time event on the approved stage hit line", () => {
    expect(projectEvent(5_000, 5_000, viewport)).toMatchObject({ x: 380, y: 507.5, visible: true });
  });

  it("keeps events outside the approach window invisible", () => {
    expect(projectEvent(5_001, 0, viewport).visible).toBe(false);
    expect(projectEvent(5_000, 0, viewport).visible).toBe(true);
    expect(projectEvent(1_000, 1_220, viewport).visible).toBe(true);
    expect(projectEvent(1_000, 1_221, viewport).visible).toBe(false);
  });

  it("scales positions to the viewport without changing event visibility", () => {
    const small = projectEvent(5_000, 4_000, { width: 380, height: 350 });
    const large = projectEvent(5_000, 4_000, viewport);
    expect(small.x).toBe(large.x / 2);
    expect(small.y).toBe(large.y / 2);
    expect(small.visible).toBe(large.visible);
  });
});
