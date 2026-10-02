import { locate } from "./fretboard.js";

export const STRING_LABELS = ["E grave", "A", "D", "G", "B", "e aguda"];
const STRING_TOLERANCE = 0.55; // strings away from the cell centre still counted as that string
const FRET_TOLERANCE = 0.4; // frets away from the ideal spot, behind the wire, still counted as well placed

/** The fretting cells a chord asks for, one per finger. */
export function targetFingers(chord) {
  const targets = new Map();
  chord.strings.forEach(({ fret, finger }, string) => {
    if (finger != null && fret > 0 && !targets.has(finger)) targets.set(finger, { finger, string, fret });
  });
  return [...targets.values()].sort((a, b) => a.finger - b.finger);
}

const cell = (string, fret) => `${STRING_LABELS[string]}${fret}`;

/** Compares one fingertip with the cell it should press and says, in plain words, what to change. */
export function judgeFinger({ target, tip, pressed, matrix }) {
  const where = `corda ${STRING_LABELS[target.string]}, casa ${target.fret}`;
  const base = { finger: target.finger, target: { string: target.string, fret: target.fret }, observed: null };
  if (!tip || !pressed) {
    return { ...base, status: "lifted", message: `Dedo ${target.finger} · levantado. Pressione a ${where}` };
  }
  const found = locate(matrix, tip);
  if (!found) return { ...base, status: "lifted", message: `Dedo ${target.finger} · não encontrei. Pressione a ${where}` };

  const observed = { string: found.string, fret: found.fret, fretOffset: found.fretOffset };
  const wrongString = Math.abs(found.s - target.string) > STRING_TOLERANCE && found.string !== target.string;
  const wrongFret = found.fret !== target.fret;

  if (wrongString || wrongFret) {
    const parts = [];
    if (wrongString) parts.push(`para a corda ${STRING_LABELS[target.string]} (${found.string > target.string ? "mais grave" : "mais aguda"})`);
    if (wrongFret) parts.push(`${found.fret > target.fret ? "recue" : "avance"} para a casa ${target.fret} (${found.fret > target.fret ? "mais perto da cabeça" : "mais perto do corpo"})`);
    const status = wrongString && wrongFret ? "wrong-cell" : wrongString ? "wrong-string" : "wrong-fret";
    const at = `está em ${cell(found.string, found.fret)}`;
    return { ...base, observed, status, message: `Dedo ${target.finger} · ${at}. ${wrongString && wrongFret ? `Leve ${parts[0]} e ${parts[1]}` : wrongString ? `Leve ${parts[0]}` : parts[0][0].toUpperCase() + parts[0].slice(1)}` };
  }
  if (found.fretOffset < -FRET_TOLERANCE) {
    return { ...base, observed, status: "far-from-fret", message: `Dedo ${target.finger} · casa ${target.fret} certa. Chegue mais perto do traste` };
  }
  if (found.fretOffset > FRET_TOLERANCE) {
    return { ...base, observed, status: "on-fret", message: `Dedo ${target.finger} · casa ${target.fret} certa. Recue um pouco, sobre o traste a nota abafa` };
  }
  return { ...base, observed, status: "ok", message: `Dedo ${target.finger} · ${where}` };
}

export const summarize = (rows) => {
  if (rows.length === 0) return "";
  const failing = rows.find((row) => row.status !== "ok");
  return failing ? failing.message.toUpperCase() : "CASAS E CORDAS CERTAS";
};
