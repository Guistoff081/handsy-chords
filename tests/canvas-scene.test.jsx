import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NoteHighway } from "../src/canvas/NoteHighway.jsx";
import { StageAtmosphere } from "../src/canvas/StageAtmosphere.jsx";

let frames;
let resize;
let context;
let images;
const props = { events: [{ atMs: 1_000, kind: "chord", chord: "Em", direction: "down" }], elapsedMs: 0, playing: false, visible: true };

function advanceFrame(time) {
  act(() => {
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach((callback) => callback(time));
  });
}

beforeEach(() => {
  frames = new Map();
  let frameId = 0;
  vi.stubGlobal("requestAnimationFrame", (callback) => {
    frames.set(++frameId, callback);
    return frameId;
  });
  vi.stubGlobal("cancelAnimationFrame", (id) => frames.delete(id));
  vi.stubGlobal("ResizeObserver", class {
    observe() { resize = this.callback; }
    constructor(callback) { this.callback = callback; }
    disconnect() {}
  });
  vi.stubGlobal("devicePixelRatio", 2);
  context = Object.fromEntries([
    "setTransform", "clearRect", "beginPath", "moveTo", "lineTo", "closePath", "fill", "stroke", "save", "restore", "ellipse", "arc", "fillText", "translate", "rotate", "drawImage",
  ].map((method) => [method, vi.fn()]));
  context.createLinearGradient = () => ({ addColorStop() {} });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);
  images = [];
  vi.stubGlobal("Image", class extends EventTarget {
    constructor() { super(); this.complete = true; this.naturalWidth = 960; this.naturalHeight = 1440; images.push(this); }
  });
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("note highway", () => {
  it("provides text guidance if Canvas is unavailable", () => {
    HTMLCanvasElement.prototype.getContext.mockReturnValue(null);
    render(<NoteHighway {...props} />);
    expect(screen.getByText(/pista visual indisponível/i)).toBeVisible();
    expect(screen.getByRole("img", { name: /ilustração estática da pista/i })).toBeInTheDocument();
    expect(frames.size).toBe(0);
  });

  it("animates dissipating sparks while paused and stops once they fade", () => {
    const { rerender } = render(<NoteHighway {...props} />);
    rerender(<NoteHighway {...props} celebrating lightning />);
    expect(frames.size).toBe(1);
    advanceFrame(0);
    context.arc.mockClear();
    advanceFrame(400);
    expect(context.arc.mock.calls.length).toBeGreaterThan(18);
    rerender(<NoteHighway {...props} celebrating={false} lightning />);
    context.arc.mockClear();
    advanceFrame(900);
    expect(context.arc).not.toHaveBeenCalled();
  });

  it("resizes the backing store in device pixels and removes events but not the hit line", () => {
    const { container, rerender } = render(<NoteHighway {...props} />);
    act(() => resize([{ contentRect: { width: 760, height: 700 } }]));
    expect(container.querySelector("canvas").width).toBe(1520);
    expect(container.querySelector("canvas").height).toBe(1400);
    expect(context.fillText).toHaveBeenCalledWith("Em", expect.any(Number), expect.any(Number));
    context.fillText.mockClear();
    context.moveTo.mockClear();
    rerender(<NoteHighway {...props} visible={false} />);
    expect(context.fillText).not.toHaveBeenCalled();
    expect(context.moveTo.mock.calls.some(([, y]) => y === 507.5)).toBe(true);
  });

  it("keeps one animation loop across clock updates and cancels it on pause/unmount", () => {
    const { rerender, unmount } = render(<NoteHighway {...props} playing />);
    expect(frames.size).toBe(1);
    const pending = [...frames.keys()][0];
    rerender(<NoteHighway {...props} elapsedMs={100} playing />);
    expect([...frames.keys()]).toEqual([pending]);
    advanceFrame(100);
    expect(frames.size).toBe(1);
    rerender(<NoteHighway {...props} />);
    expect(frames.size).toBe(0);
    rerender(<NoteHighway {...props} playing reducedMotion />);
    expect(frames.size).toBe(0);
    rerender(<NoteHighway {...props} playing />);
    unmount();
    expect(frames.size).toBe(0);
  });

  it("gates a transient celebration on lightning and reduced-motion preferences", () => {
    const { rerender } = render(<NoteHighway {...props} celebrating playing lightning={false} />);
    expect(context.arc).not.toHaveBeenCalled();
    rerender(<NoteHighway {...props} celebrating playing lightning />);
    expect(context.arc).toHaveBeenCalled();
    context.arc.mockClear();
    rerender(<NoteHighway {...props} celebrating playing lightning reducedMotion />);
    expect(context.arc).not.toHaveBeenCalled();
    rerender(<NoteHighway {...props} celebrating playing lightning />);
    advanceFrame(0);
    advanceFrame(1_000);
    context.arc.mockClear();
    advanceFrame(1_100);
    expect(context.arc).not.toHaveBeenCalled();
  });
});

describe("failure feedback on the highway", () => {
  function recordHitLineColors() {
    const colors = [];
    context.stroke = vi.fn(function stroke() { colors.push(this.strokeStyle); });
    return colors;
  }

  it("shakes the track and turns the hit line magenta for a missed chord, then recovers", () => {
    const colors = recordHitLineColors();
    const { rerender } = render(<NoteHighway {...props} failure={0} />);
    expect(colors).not.toContain("#ff4f88");
    context.translate.mockClear();
    rerender(<NoteHighway {...props} failure={1} />);
    expect(colors).toContain("#ff4f88");
    advanceFrame(0);
    advanceFrame(100);
    expect(context.translate).toHaveBeenCalled();
    advanceFrame(600);
    colors.length = 0;
    advanceFrame(700);
    expect(colors).not.toContain("#ff4f88");
  });

  it("keeps only the colour change, without shaking, under reduced motion", () => {
    const colors = recordHitLineColors();
    const { rerender } = render(<NoteHighway {...props} reducedMotion failure={0} />);
    context.translate.mockClear();
    rerender(<NoteHighway {...props} reducedMotion failure={1} />);
    expect(colors).toContain("#ff4f88");
    expect(context.translate).not.toHaveBeenCalled();
    expect(frames.size).toBe(0);
  });

  it("reacts once per failure id", () => {
    recordHitLineColors();
    const { rerender } = render(<NoteHighway {...props} failure={3} />);
    advanceFrame(0);
    advanceFrame(600);
    advanceFrame(700);
    context.translate.mockClear();
    rerender(<NoteHighway {...props} failure={3} elapsedMs={50} />);
    advanceFrame(800);
    expect(context.translate).not.toHaveBeenCalled();
  });
});

describe("stage atmosphere", () => {
  it("reuses the smoke image, freezes on pause, uses one reduced-motion wisp, and clears when disabled", () => {
    const { rerender, unmount } = render(<StageAtmosphere smoke playing />);
    expect(images).toHaveLength(1);
    expect(images[0].src).toBe("/assets/smoke-wisp.png");
    expect(context.drawImage).toHaveBeenCalledTimes(2);
    advanceFrame(0);
    advanceFrame(1_000);
    expect(frames.size).toBe(1);
    context.translate.mockClear();
    rerender(<StageAtmosphere smoke playing={false} />);
    const frozen = context.translate.mock.calls.slice();
    context.translate.mockClear();
    rerender(<StageAtmosphere smoke playing={false} elapsedMs={500} />);
    expect(context.translate.mock.calls).toEqual(frozen);
    expect(frames.size).toBe(0);
    context.drawImage.mockClear();
    rerender(<StageAtmosphere smoke playing reducedMotion />);
    expect(context.drawImage).toHaveBeenCalledTimes(1);
    expect(frames.size).toBe(0);
    context.drawImage.mockClear();
    context.clearRect.mockClear();
    rerender(<StageAtmosphere smoke={false} playing />);
    expect(context.drawImage).not.toHaveBeenCalled();
    expect(context.clearRect).toHaveBeenCalled();
    rerender(<StageAtmosphere smoke playing />);
    expect(images).toHaveLength(1);
    unmount();
    expect(frames.size).toBe(0);
  });
});
