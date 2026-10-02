// Pure geometry on MediaPipe hand landmarks (21 points). Finger numbers follow guitar teaching:
// 1 index, 2 middle, 3 ring, 4 pinky. The thumb is not used to fret the chords in this prototype.

export const FINGER_JOINTS = {
  1: { mcp: 5, pip: 6, tip: 8 },
  2: { mcp: 9, pip: 10, tip: 12 },
  3: { mcp: 13, pip: 14, tip: 16 },
  4: { mcp: 17, pip: 18, tip: 20 },
};

// A straight finger reads ~175 degrees at the PIP joint; one pressing a string is bent well below this.
export const PRESSED_BELOW_DEGREES = 140;

export function jointAngle(a, b, c) {
  const ux = a.x - b.x; const uy = a.y - b.y; const uz = (a.z ?? 0) - (b.z ?? 0);
  const vx = c.x - b.x; const vy = c.y - b.y; const vz = (c.z ?? 0) - (b.z ?? 0);
  const norm = Math.hypot(ux, uy, uz) * Math.hypot(vx, vy, vz);
  if (norm === 0) return 180;
  const cosine = Math.max(-1, Math.min(1, (ux * vx + uy * vy + uz * vz) / norm));
  return (Math.acos(cosine) * 180) / Math.PI;
}

/** Bend of each finger at the PIP joint, using metric (world) landmarks so the camera angle does not matter. */
export function fingerAngles(landmarks) {
  const angles = {};
  for (const [finger, { mcp, pip, tip }] of Object.entries(FINGER_JOINTS)) {
    angles[finger] = jointAngle(landmarks[mcp], landmarks[pip], landmarks[tip]);
  }
  return angles;
}

export function pressedFingers(landmarks, threshold = PRESSED_BELOW_DEGREES) {
  const angles = fingerAngles(landmarks);
  return Object.keys(angles).map(Number).filter((finger) => angles[finger] < threshold);
}

/** Fingers a chord needs on the fretboard, from its canonical shape. */
export function fingersForChord(chord) {
  return [...new Set(chord.strings.filter(({ finger }) => finger != null).map(({ finger }) => finger))].sort();
}

export function compareFingers(pressed, expected) {
  const missing = expected.filter((finger) => !pressed.includes(finger));
  const extra = pressed.filter((finger) => !expected.includes(finger));
  return { status: missing.length ? "missing" : extra.length ? "extra" : "ok", missing, extra, pressed: [...pressed].sort() };
}

function list(fingers) {
  if (fingers.length === 1) return String(fingers[0]);
  return `${fingers.slice(0, -1).join(", ")} E ${fingers.at(-1)}`;
}

export function describeComparison({ status, missing, extra, pressed }) {
  if (status === "missing") return missing.length === 1 ? `FALTA O DEDO ${missing[0]}` : `FALTAM OS DEDOS ${list(missing)}`;
  if (status === "extra") return extra.length === 1 ? `DEDO ${extra[0]} SOBRANDO` : `DEDOS ${list(extra)} SOBRANDO`;
  return `DEDOS CERTOS · ${list(pressed)} FIRMES`;
}
