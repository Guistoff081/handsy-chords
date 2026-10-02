// Test-only: synthesises plucked-guitar-like chords and a radix-2 FFT so the detector can be
// exercised end to end without a browser.

export const OPEN_VOICINGS = {
  Em: [82.41, 123.47, 164.81, 196.0, 246.94, 329.63],
  G: [98.0, 123.47, 146.83, 196.0, 246.94, 392.0],
  C: [130.81, 164.81, 196.0, 261.63, 329.63],
  D: [146.83, 220.0, 293.66, 369.99],
  A: [110.0, 164.81, 220.0, 277.18, 329.63],
  Am: [110.0, 164.81, 220.0, 261.63, 329.63],
  E: [82.41, 123.47, 164.81, 207.65, 246.94, 329.63],
};

export function synthChord(frequencies, { sampleRate = 44_100, length = 16_384, noise = 0, seed = 7 } = {}) {
  let state = seed;
  const random = () => { state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296; return state / 4_294_967_296 - 0.5; };
  const samples = new Float32Array(length);
  frequencies.forEach((frequency, string) => {
    const detune = 1 + (string % 2 ? 0.0006 : -0.0004);
    for (let partial = 1; partial <= 8; partial += 1) {
      const amplitude = 1 / partial ** 1.3;
      const phase = string * 0.7 + partial;
      for (let i = 0; i < length; i += 1) {
        samples[i] += amplitude * Math.sin(2 * Math.PI * frequency * detune * partial * (i / sampleRate) + phase);
      }
    }
  });
  for (let i = 0; i < length; i += 1) samples[i] += noise * random();
  return samples;
}

export function magnitudeSpectrum(samples) {
  const n = samples.length;
  const re = Float64Array.from(samples, (value, i) => value * (0.42 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)) + 0.08 * Math.cos((4 * Math.PI * i) / (n - 1))));
  const im = new Float64Array(n);
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const angle = (-2 * Math.PI) / size;
    for (let start = 0; start < n; start += size) {
      for (let k = 0; k < size / 2; k += 1) {
        const cos = Math.cos(angle * k);
        const sin = Math.sin(angle * k);
        const a = start + k;
        const b = a + size / 2;
        const tr = re[b] * cos - im[b] * sin;
        const ti = re[b] * sin + im[b] * cos;
        re[b] = re[a] - tr; im[b] = im[a] - ti;
        re[a] += tr; im[a] += ti;
      }
    }
  }
  const half = n / 2;
  const magnitudes = new Float32Array(half);
  for (let i = 0; i < half; i += 1) magnitudes[i] = Math.hypot(re[i], im[i]);
  return magnitudes;
}

/** Karplus-Strong plucked strings, strummed low to high 12 ms apart. Rings with realistically strong upper partials. */
export function pluckedStrum(frequencies, { sampleRate = 44_100, seconds = 0.6, seed = 3 } = {}) {
  let state = seed;
  const random = () => { state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296; return state / 4_294_967_296 * 2 - 1; };
  const out = new Float32Array(Math.floor(seconds * sampleRate));
  frequencies.forEach((frequency, string) => {
    const period = Math.floor(sampleRate / frequency);
    const ring = Float32Array.from({ length: period }, random);
    const start = Math.floor(string * 0.012 * sampleRate);
    for (let i = 0; start + i < out.length; i += 1) {
      const slot = i % period;
      out[start + i] += ring[slot] * 0.22;
      ring[slot] = 0.5 * (ring[slot] + ring[(slot + 1) % period]) * 0.9965;
    }
  });
  return out;
}
