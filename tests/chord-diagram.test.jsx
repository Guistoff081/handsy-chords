import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChordDiagram, drawChordDiagram } from "../src/components/ChordDiagram.jsx";
import { HandCoach } from "../src/components/HandCoach.jsx";
import { getChord } from "../src/data/chords.js";
import App from "../src/App.jsx";

const emDescription = "Acorde Em: dedo 2 na corda A, casa 2; dedo 3 na corda D, casa 2; demais cordas soltas.";

// jsdom has no raster Canvas backend. Record drawing commands at that boundary.
function recordingContext() {
  const strokes = [];
  const fills = [];
  const labels = [];
  let path = [];
  return {
    strokes, fills, labels,
    clearRect() { strokes.length = 0; fills.length = 0; labels.length = 0; },
    setTransform: vi.fn(),
    beginPath() { path = []; },
    moveTo(x, y) { path.push({ type: "move", x, y }); },
    lineTo(x, y) { path.push({ type: "line", x, y }); },
    arc(x, y, radius) { path.push({ type: "arc", x, y, radius }); },
    stroke() { strokes.push({ color: this.strokeStyle, path: [...path] }); },
    fill() { fills.push({ color: this.fillStyle, path: [...path] }); },
    fillText(text, x, y) { labels.push({ text, x, y }); },
    save() {},
    restore() {},
  };
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("deterministic chord diagram", () => {
  it("draws six ordered horizontal strings and three fret regions with accurate Em targets", () => {
    const context = recordingContext();
    drawChordDiagram(context, getChord("Em"), { width: 360, height: 220 });

    const strings = context.labels.filter(({ text }) => ["e", "B", "G", "D", "A", "E"].includes(text));
    expect(strings.map(({ text }) => text)).toEqual(["E", "A", "D", "G", "B", "e"]);
    const lines = context.strokes.map(({ path }) => path).filter((path) => path.length === 2);
    const horizontal = lines.filter(([start, end]) => start.y === end.y);
    const vertical = lines.filter(([start, end]) => start.x === end.x);
    expect(horizontal).toHaveLength(6);
    expect(vertical).toHaveLength(4);
    const secondFretStart = vertical[1][0].x;
    const secondFretEnd = vertical[2][0].x;
    for (const [finger, stringName] of [["2", "A"], ["3", "D"]]) {
      const label = context.labels.find(({ text, y }) => text === finger && y > strings[0].y);
      expect(label.y).toBe(strings.find(({ text }) => text === stringName).y);
      expect(label.x).toBeGreaterThan(secondFretStart);
      expect(label.x).toBeLessThan(secondFretEnd);
      expect(label.x).toBeGreaterThan((secondFretStart + secondFretEnd) / 2);
      const observed = context.strokes.find(({ color, path }) => color === "#ff4f88" && path[0]?.type === "arc" && path[0].y === label.y);
      expect(observed.path[0].x).toBeLessThan(label.x);
      expect(observed.path[0].x).toBeGreaterThan(secondFretStart);
    }
    expect(context.fills.filter(({ color }) => color === "#15d9f5")).toHaveLength(2);
  });

  it("can lay the strings out as in tablature, high e on top, and still place the fingers on the right strings", () => {
    const context = recordingContext();
    drawChordDiagram(context, getChord("Em"), { width: 360, height: 220, lowOnTop: false });
    const rows = context.labels.filter(({ text }) => ["e", "B", "G", "D", "A", "E"].includes(text));
    expect(rows.map(({ text }) => text)).toEqual(["e", "B", "G", "D", "A", "E"]);
    for (const [finger, stringName] of [["2", "A"], ["3", "D"]]) {
      const label = context.labels.find(({ text, y }) => text === finger && y > rows[0].y);
      expect(label.y).toBe(rows.find(({ text }) => text === stringName).y);
    }
  });

  it("renders accurate G targets without simulated observations in target-only mode", () => {
    const context = recordingContext();
    drawChordDiagram(context, getChord("G"), { width: 180, height: 110, showObserved: false });
    expect(context.fills.filter(({ color }) => color === "#15d9f5")).toHaveLength(3);
    expect(context.strokes.some(({ color }) => color === "#ff4f88")).toBe(false);
    const rows = context.labels.filter(({ text }) => ["e", "B", "G", "D", "A", "E"].includes(text));
    for (const [finger, string] of [["3", "e"], ["1", "A"], ["2", "E"]]) {
      expect(context.labels.some(({ text, y }) => text === finger && y === rows.find(({ text }) => text === string).y)).toBe(true);
    }
  });

  it("retains an accessible image and readable fallback without a Canvas context", () => {
    render(<ChordDiagram chord={getChord("Em")} />);
    expect(screen.getByRole("img", { name: emDescription })).toBeInTheDocument();
    expect(screen.getByText(emDescription, { selector: "p" })).toBeVisible();
    expect(() => drawChordDiagram(null, getChord("Em"), { width: 360, height: 220 })).not.toThrow();
  });

  it("redraws responsively at device pixel ratio and releases observation and resize listeners", () => {
    const context = recordingContext();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);
    let measuredWidth = 240;
    vi.spyOn(HTMLCanvasElement.prototype, "getBoundingClientRect").mockImplementation(() => ({ width: measuredWidth }));
    vi.stubGlobal("devicePixelRatio", 2);
    let notifyResize;
    const disconnect = vi.fn();
    vi.stubGlobal("ResizeObserver", class {
      constructor(callback) { notifyResize = callback; }
      observe() {}
      disconnect = disconnect;
    });
    const { unmount } = render(<ChordDiagram chord={getChord("Em")} width={360} height={220} />);
    const canvas = screen.getByRole("img");
    expect(canvas.width).toBe(480);
    expect(canvas.height).toBe(293);
    expect(context.setTransform).toHaveBeenLastCalledWith(2, 0, 0, 2, 0, 0);
    measuredWidth = 180;
    act(() => notifyResize());
    expect(canvas.width).toBe(360);
    expect(canvas.height).toBe(220);
    vi.stubGlobal("devicePixelRatio", 1);
    fireEvent(window, new Event("resize"));
    expect(canvas.width).toBe(180);
    expect(canvas.height).toBe(110);
    unmount();
    expect(disconnect).toHaveBeenCalledOnce();
    const drawCount = context.setTransform.mock.calls.length;
    fireEvent(window, new Event("resize"));
    expect(context.setTransform).toHaveBeenCalledTimes(drawCount);
  });
});

describe("hand coach integration", () => {
  it("distinguishes canonical targets from the simulated observed camera position", () => {
    render(<HandCoach />);
    const coach = screen.getByRole("complementary", { name: "Orientação de mão" });
    expect(within(coach).getByRole("img", { name: emDescription })).toBeInTheDocument();
    expect(within(coach).getByText("ALVO")).toBeVisible();
    expect(within(coach).getByText("AGORA")).toBeVisible();
    expect(within(coach).getByText("DEDO 3 · MAIS PERTO DO TRASTE")).toBeVisible();
    expect(within(coach).getByText("Câmera simulada · posição observada")).toBeVisible();
    expect(within(coach).getByRole("img", { name: /Mão observada/ })).toHaveAttribute("src", "/assets/hand-camera.webp");
  });

  it("toggles only the hand coach and includes canonical compact Em and G diagrams", () => {
    render(<App />);
    expect(screen.getByRole("complementary", { name: "Orientação de mão" })).toBeInTheDocument();
    const next = screen.getByRole("complementary", { name: "Próximo acorde" });
    expect(within(next).getByRole("img", { name: emDescription })).toBeInTheDocument();
    expect(within(next).getByRole("img", { name: /Acorde G: dedo 2 na corda E, casa 3; dedo 1 na corda A, casa 2; dedo 3 na corda e, casa 3/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mão" }));
    expect(screen.queryByRole("complementary", { name: "Orientação de mão" })).not.toBeInTheDocument();
    expect(next).toBeInTheDocument();
    expect(screen.getByText("Come as you are, as you were")).toBeVisible();
  });
});
