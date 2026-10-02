import { getChord } from "../data/chords.js";
import { cellPoint, checkFit, fitAffine, fretWire, pressCoordinate, stringSpacing, toImage } from "./fretboard.js";
import { judgeFinger, summarize, targetFingers } from "./fingerCheck.js";

// The chord held during calibration: three fingers on strings far apart (E, A, e) and on two different frets,
// which pins down both the string axis and the along-neck scale.
export const CALIBRATION_CHORD = "G";
const STABLE_FRAMES = 18;
const MAX_SPREAD = 0.012; // of the frame width, per coordinate, over the stable window
const TIMEOUT_MS = 15_000;
const SMOOTHING = 0.55;
const HYSTERESIS_FRAMES = 4;
const FINGERS = [1, 2, 3, 4];
// While calibrating, a finger only has to be visibly bent (the model's depth is noisy); judging keeps the strict test.
const CALIBRATION_BEND_BELOW = 160;

const MESSAGES = {
  tamanho: "A leitura saiu fora do esperado. Aproxime o braço da câmera e tente de novo.",
  inclinação: "Gire o violão para o braço ficar de frente para a câmera e tente de novo.",
  fit: "Não consegui montar a grade. Tente de novo com os três dedos bem firmes.",
  timeout: "Não vi o G parado. Mostre os três dedos firmes e segure por um segundo.",
};

const spread = (values) => Math.max(...values) - Math.min(...values);

/**
 * Turns hand-tracking frames into fretboard feedback. After the person holds a G still, the engine knows where the
 * neck is in the image and judges every finger against the cell the current chord asks for.
 * Pure state machine: the clock and the drawing surface are passed in, so it is testable without a browser.
 */
export function createCoachEngine({ chord = "Em", now = () => performance.now() } = {}) {
  let chordName = chord;
  let matrix = null;
  let size = { width: 1280, height: 720 };
  let calibration = { status: "none", progress: 0, message: "" };
  let collecting = null;
  let smoothed = {};
  let rows = [];
  const pending = {};
  const shown = {};

  function fail(reason) {
    collecting = null;
    calibration = { status: "failed", progress: 0, message: MESSAGES[reason] ?? MESSAGES.fit };
  }

  function smooth(tips, present) {
    if (!present) { smoothed = {}; return; }
    for (const finger of FINGERS) {
      const tip = tips[finger];
      if (!tip) continue;
      const previous = smoothed[finger];
      smoothed[finger] = previous ? { x: previous.x + (tip.x - previous.x) * SMOOTHING, y: previous.y + (tip.y - previous.y) * SMOOTHING } : { ...tip };
    }
  }

  function collect(frame) {
    const needed = targetFingers(getChord(CALIBRATION_CHORD)).map((target) => target.finger);
    const bent = (finger) => (frame.angles ? frame.angles[finger] < CALIBRATION_BEND_BELOW : frame.pressed.includes(finger));
    const holding = frame.present && needed.every((finger) => bent(finger) && frame.tips[finger]);
    if (now() - collecting.startedAt > TIMEOUT_MS) { fail("timeout"); return; }
    if (!holding) { collecting.window = []; calibration = { ...calibration, progress: 0 }; return; }
    collecting.window.push(Object.fromEntries(needed.map((finger) => [finger, { ...frame.tips[finger] }])));
    const steady = needed.every((finger) => {
      const xs = collecting.window.map((sample) => sample[finger].x);
      const ys = collecting.window.map((sample) => sample[finger].y);
      return spread(xs) <= MAX_SPREAD * size.width && spread(ys) <= MAX_SPREAD * size.width;
    });
    if (!steady) { collecting.window = collecting.window.slice(-1); calibration = { ...calibration, progress: 0 }; return; }
    calibration = { ...calibration, progress: Math.min(1, collecting.window.length / STABLE_FRAMES) };
    if (collecting.window.length < STABLE_FRAMES) return;

    const points = targetFingers(getChord(CALIBRATION_CHORD)).map(({ finger, string, fret }) => {
      const xs = collecting.window.map((sample) => sample[finger].x);
      const ys = collecting.window.map((sample) => sample[finger].y);
      return { s: string, q: pressCoordinate(fret), x: xs.reduce((a, b) => a + b) / xs.length, y: ys.reduce((a, b) => a + b) / ys.length };
    });
    const fit = fitAffine(points);
    if (!fit) { fail("fit"); return; }
    const verdict = checkFit(fit, size.width);
    if (!verdict.ok) { fail(verdict.reason); return; }
    matrix = fit;
    collecting = null;
    rows = [];
    calibration = { status: "ready", progress: 1, message: "" };
  }

  function judge(frame) {
    const targets = targetFingers(getChord(chordName));
    rows = targets.map((target) => {
      const candidate = judgeFinger({ target, tip: smoothed[target.finger], pressed: frame.present && frame.pressed.includes(target.finger), matrix });
      // A verdict must hold for a few frames before it replaces the one on screen, so the text does not flicker.
      const key = `${chordName}:${target.finger}`;
      const queued = pending[key];
      pending[key] = queued && queued.status === candidate.status ? { ...queued, count: queued.count + 1, row: candidate } : { status: candidate.status, count: 1, row: candidate };
      if (!shown[key] || pending[key].count >= HYSTERESIS_FRAMES) shown[key] = pending[key].row;
      return shown[key];
    });
  }

  return {
    setChord(name) { chordName = name; },
    startCalibration() {
      collecting = { startedAt: now(), window: [] };
      calibration = { status: "collecting", progress: 0, message: "" };
    },
    cancelCalibration() {
      collecting = null;
      calibration = { status: matrix ? "ready" : "none", progress: 0, message: "" };
    },
    clearCalibration() {
      matrix = null; collecting = null; rows = [];
      calibration = { status: "none", progress: 0, message: "" };
    },
    process(frame) {
      size = frame.size ?? size;
      smooth(frame.tips ?? {}, frame.present);
      if (collecting) collect({ ...frame, tips: frame.tips ?? {}, pressed: frame.pressed ?? [] });
      if (matrix && !collecting) judge({ ...frame, pressed: frame.pressed ?? [] });
      if (!frame.present && matrix) rows = rows.map((row) => ({ ...row, status: "lifted", message: `Dedo ${row.finger} · mão fora da imagem` }));
    },
    snapshot() {
      return {
        calibration,
        calibrated: Boolean(matrix),
        fingers: rows.map(({ finger, status, message, target }) => ({ finger, status, message, target })),
        summary: matrix ? summarize(rows) : "",
      };
    },
    /** Grid, target cells and what is wrong, in unmirrored video pixels. Pulses with `time` (ms). */
    draw(context, time = 0) {
      if (!matrix) return;
      const spacing = stringSpacing(matrix);
      const reach = fretWire(6);
      context.save();
      context.lineWidth = Math.max(1.5, size.width / 600);
      context.strokeStyle = "rgba(56, 214, 232, 0.4)";
      for (let string = 0; string < 6; string += 1) {
        const from = toImage(matrix, string, 0);
        const to = toImage(matrix, string, reach);
        context.beginPath(); context.moveTo(from.x, from.y); context.lineTo(to.x, to.y); context.stroke();
      }
      for (let fret = 0; fret <= 6; fret += 1) {
        const from = toImage(matrix, -0.4, fretWire(fret));
        const to = toImage(matrix, 5.4, fretWire(fret));
        context.strokeStyle = fret === 0 ? "rgba(232, 237, 247, 0.7)" : "rgba(232, 237, 247, 0.32)";
        context.lineWidth = fret === 0 ? Math.max(3, size.width / 300) : Math.max(1.5, size.width / 600);
        context.beginPath(); context.moveTo(from.x, from.y); context.lineTo(to.x, to.y); context.stroke();
      }
      const pulse = 1 + 0.22 * Math.sin(time / 140);
      rows.forEach((row) => {
        const goal = cellPoint(matrix, row.target.string, row.target.fret);
        const tip = smoothed[row.finger];
        context.lineWidth = Math.max(2.5, size.width / 320);
        if (row.status === "ok") {
          context.strokeStyle = "#38d6e8";
          context.beginPath(); context.arc(goal.x, goal.y, spacing * 0.42, 0, Math.PI * 2); context.stroke();
          return;
        }
        context.strokeStyle = "#38d6e8";
        context.setLineDash([6, 6]);
        context.beginPath(); context.arc(goal.x, goal.y, spacing * 0.42, 0, Math.PI * 2); context.stroke();
        context.setLineDash([]);
        if (tip && row.status !== "lifted") {
          context.strokeStyle = "#e24a8d";
          context.beginPath(); context.arc(tip.x, tip.y, spacing * 0.42 * pulse, 0, Math.PI * 2); context.stroke();
          context.beginPath(); context.moveTo(tip.x, tip.y); context.lineTo(goal.x, goal.y); context.stroke();
        }
      });
      context.restore();
    },
  };
}
