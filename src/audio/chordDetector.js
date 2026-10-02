// Pure chord recognition from an FFT magnitude spectrum: pitch-class profile (chroma)
// matched against major/minor triad templates. No browser APIs, so it is unit-testable.

export const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const MIN_HZ = 70;
const MAX_HZ = 1_500;
const PEAK_FLOOR = 0.05;

function buildTemplates() {
  const templates = [];
  for (let root = 0; root < 12; root += 1) {
    for (const [suffix, third] of [["", 4], ["m", 3]]) {
      const profile = new Array(12).fill(0);
      profile[root] = 1;
      profile[(root + third) % 12] = 0.85;
      profile[(root + 7) % 12] = 0.9;
      const norm = Math.hypot(...profile);
      templates.push({ name: `${NOTE_NAMES[root]}${suffix}`, profile: profile.map((value) => value / norm) });
    }
  }
  return templates;
}

export const CHORD_TEMPLATES = buildTemplates();

export function frequencyToPitchClass(frequency) {
  const midi = Math.round(69 + 12 * Math.log2(frequency / 440));
  return ((midi % 12) + 12) % 12;
}

const MAX_PARTIAL = 6;
const PARTIAL_TOLERANCE = 0.035; // log2 distance, about 42 cents
const PARTIAL_SHARE = 0.9;

/** Finds spectral peaks above the floor with sub-bin frequency (parabolic interpolation). */
function findPeaks(magnitudes, sampleRate, fftSize) {
  const binHz = sampleRate / fftSize;
  const first = Math.max(1, Math.floor(MIN_HZ / binHz));
  const last = Math.min(magnitudes.length - 2, Math.ceil(MAX_HZ / binHz));
  let strongest = 0;
  for (let bin = first; bin <= last; bin += 1) strongest = Math.max(strongest, magnitudes[bin]);
  const peaks = [];
  if (strongest <= 0) return peaks;
  for (let bin = first; bin <= last; bin += 1) {
    const value = magnitudes[bin];
    if (value < strongest * PEAK_FLOOR || value <= magnitudes[bin - 1] || value < magnitudes[bin + 1]) continue;
    const left = magnitudes[bin - 1];
    const right = magnitudes[bin + 1];
    const denominator = left - 2 * value + right;
    const offset = denominator === 0 ? 0 : (0.5 * (left - right)) / denominator;
    peaks.push({ frequency: (bin + offset) * binHz, magnitude: value });
  }
  return peaks;
}

/**
 * A plucked string rings with partials that land on other pitch classes (the 5th partial of a low E is a
 * G#, which would turn Em into E). Walking up from the lowest peak, each peak takes its share back from the
 * peaks sitting on its own partials, so the chroma follows fundamentals instead of overtones.
 */
function suppressPartials(peaks) {
  const ordered = [...peaks].sort((a, b) => a.frequency - b.frequency).map((peak) => ({ ...peak }));
  ordered.forEach((root, index) => {
    if (root.magnitude <= 0) return;
    for (let partial = 2; partial <= MAX_PARTIAL; partial += 1) {
      const target = root.frequency * partial;
      for (let next = index + 1; next < ordered.length; next += 1) {
        const candidate = ordered[next];
        if (candidate.frequency > target * 1.05) break;
        if (Math.abs(Math.log2(candidate.frequency / target)) <= PARTIAL_TOLERANCE) {
          candidate.magnitude = Math.max(0, candidate.magnitude - (root.magnitude * PARTIAL_SHARE) / partial);
        }
      }
    }
  });
  return ordered;
}

/** Sums the strongest fundamentals into 12 pitch classes, de-emphasising high partials. */
export function chromaFromSpectrum(magnitudes, sampleRate, fftSize) {
  const chroma = new Array(12).fill(0);
  for (const { frequency, magnitude } of suppressPartials(findPeaks(magnitudes, sampleRate, fftSize))) {
    chroma[frequencyToPitchClass(frequency)] += magnitude * (frequency < 500 ? 1 : 500 / frequency);
  }
  const total = chroma.reduce((sum, value) => sum + value, 0);
  return total > 0 ? chroma.map((value) => value / total) : chroma;
}

export function averageChroma(frames) {
  const sum = new Array(12).fill(0);
  frames.forEach((frame) => frame.forEach((value, index) => { sum[index] += value; }));
  const total = sum.reduce((acc, value) => acc + value, 0);
  return total > 0 ? sum.map((value) => value / total) : sum;
}

/**
 * Returns the best-matching triad with its cosine score and the margin over the runner-up.
 * `candidates` limits the search to a vocabulary (the chords of the song being practised).
 */
export function detectChord(chroma, candidates = null) {
  const norm = Math.hypot(...chroma);
  if (norm === 0) return { name: null, score: 0, margin: 0 };
  const pool = candidates ? CHORD_TEMPLATES.filter(({ name }) => candidates.includes(name)) : CHORD_TEMPLATES;
  if (pool.length === 0) return { name: null, score: 0, margin: 0 };
  const ranked = pool
    .map(({ name, profile }) => ({ name, score: profile.reduce((sum, value, index) => sum + value * chroma[index], 0) / norm }))
    .sort((a, b) => b.score - a.score);
  const runnerUp = ranked[1]?.score ?? 0;
  return { name: ranked[0].name, score: ranked[0].score, margin: ranked[0].score - runnerUp };
}

/** Confidence is the cosine score, discounted when the runner-up is nearly as good. */
export function chordConfidence({ score, margin }) {
  return Math.max(0, Math.min(1, score * Math.min(1, 0.6 + margin * 6)));
}

/** Detections below this confidence are treated as "unclear" and never judged. */
export const ACCEPT_CONFIDENCE = 0.6;
