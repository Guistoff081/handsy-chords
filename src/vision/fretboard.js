// Fretboard geometry in image space. A calibration maps (string, fret position) to pixels with an affine
// transform; the along-neck coordinate follows equal temperament, so frets get closer towards the body.
//
//   s : string index, 0 = low E ... 5 = high e (continuous)
//   q : fret-wire coordinate, q(f) = 1 - 2^(-f/12) (0 at the nut, ~0.5 at the 12th fret)
//
// A pressed finger sits a little behind the wire of its fret, so it is placed at q(fret - PRESS_OFFSET).

export const STRING_COUNT = 6;
export const PRESS_OFFSET = 0.3;

export const fretWire = (fret) => 1 - 2 ** (-fret / 12);
export const pressCoordinate = (fret) => fretWire(fret - PRESS_OFFSET);
/** Continuous "pressed fret" of a coordinate: equals the fret number when a finger sits at its ideal spot. */
export const fretFromCoordinate = (q) => -12 * Math.log2(1 - Math.min(q, 0.999)) + PRESS_OFFSET;

function solve3(matrix, vector) {
  const m = matrix.map((row, i) => [...row, vector[i]]);
  for (let col = 0; col < 3; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < 3; row += 1) if (Math.abs(m[row][col]) > Math.abs(m[pivot][col])) pivot = row;
    if (Math.abs(m[pivot][col]) < 1e-12) return null;
    [m[col], m[pivot]] = [m[pivot], m[col]];
    for (let row = 0; row < 3; row += 1) {
      if (row === col) continue;
      const factor = m[row][col] / m[col][col];
      for (let k = col; k < 4; k += 1) m[row][k] -= factor * m[col][k];
    }
  }
  return [m[0][3] / m[0][0], m[1][3] / m[1][1], m[2][3] / m[2][2]];
}

/** Least-squares affine fit of image points on (s, q). Needs 3+ non-collinear points. */
export function fitAffine(points) {
  if (points.length < 3) return null;
  const normal = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const rx = [0, 0, 0];
  const ry = [0, 0, 0];
  for (const { s, q, x, y } of points) {
    const row = [s, q, 1];
    for (let i = 0; i < 3; i += 1) {
      for (let j = 0; j < 3; j += 1) normal[i][j] += row[i] * row[j];
      rx[i] += row[i] * x;
      ry[i] += row[i] * y;
    }
  }
  const px = solve3(normal, rx);
  const py = solve3(normal, ry);
  if (!px || !py) return null;
  return { a: px[0], b: px[1], c: px[2], d: py[0], e: py[1], f: py[2] };
}

export const toImage = (m, s, q) => ({ x: m.a * s + m.b * q + m.c, y: m.d * s + m.e * q + m.f });

export function toBoard(m, { x, y }) {
  const det = m.a * m.e - m.b * m.d;
  if (Math.abs(det) < 1e-9) return null;
  const dx = x - m.c;
  const dy = y - m.f;
  return { s: (dx * m.e - m.b * dy) / det, q: (m.a * dy - m.d * dx) / det };
}

/** Where a fingertip sits on the neck: nearest string, nearest fret, and how far off the ideal spot. */
export function locate(m, point) {
  const board = toBoard(m, point);
  if (!board) return null;
  const fretPosition = fretFromCoordinate(board.q);
  return {
    s: board.s,
    string: Math.max(0, Math.min(STRING_COUNT - 1, Math.round(board.s))),
    fretPosition,
    fret: Math.max(0, Math.round(fretPosition)),
    fretOffset: fretPosition - Math.round(fretPosition),
  };
}

/** Image point where a finger should be for a string/fret cell. */
export const cellPoint = (m, string, fret) => toImage(m, string, pressCoordinate(fret));

export const stringSpacing = (m) => Math.hypot(m.a, m.d);

/** Rejects fits that cannot be a fretboard seen from a webcam. Sizes are checked against the frame width. */
export function checkFit(m, frameWidth) {
  const spacing = stringSpacing(m) / frameWidth;
  const fretStep = Math.hypot(m.b, m.e) * (fretWire(1) - fretWire(0)) / frameWidth;
  const cosine = Math.abs((m.a * m.b + m.d * m.e) / (Math.hypot(m.a, m.d) * Math.hypot(m.b, m.e) || 1));
  if (spacing < 0.008 || spacing > 0.14) return { ok: false, reason: "tamanho" };
  if (fretStep < 0.015 || fretStep > 0.3) return { ok: false, reason: "tamanho" };
  if (cosine > 0.65) return { ok: false, reason: "inclinação" };
  return { ok: true };
}
