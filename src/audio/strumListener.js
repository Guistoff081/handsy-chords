import { ACCEPT_CONFIDENCE, averageChroma, chordConfidence, chromaFromSpectrum, detectChord } from "./chordDetector.js";

export const FFT_SIZE = 16_384;
const RMS_WINDOW = 1_024;
const MIN_RMS = 0.015;
const ONSET_RATIO = 2.5;
const ONSET_RISE = 1.25;
const REFRACTORY_MS = 300;
// The analyser window (~370 ms) still holds the previous chord at the attack, so wait for it to clear.
export const SETTLE_MS = 150;
export const COLLECT_MS = 200;
const LEVEL_EVERY_MS = 100;

/**
 * Watches an AnalyserNode-like source: detects the attack of a strum from the time-domain energy,
 * then averages the chroma of the following ~200 ms and names the chord.
 * The clock is injected so the logic runs the same in tests and in the browser.
 */
export function createStrumListener({ analyser, sampleRate, now, onStrum, onLevel, vocabulary = null }) {
  const waveform = new Float32Array(analyser.fftSize);
  const decibels = new Float32Array(analyser.frequencyBinCount);
  const magnitudes = new Float32Array(analyser.frequencyBinCount);
  let floor = 0.005;
  let previous = 0;
  let lastOnset = -Infinity;
  let lastLevel = -Infinity;
  let capture = null;

  function measure() {
    analyser.getFloatTimeDomainData(waveform);
    let sum = 0;
    for (let i = waveform.length - RMS_WINDOW; i < waveform.length; i += 1) sum += waveform[i] * waveform[i];
    return Math.sqrt(sum / RMS_WINDOW);
  }

  function readChroma() {
    analyser.getFloatFrequencyData(decibels);
    for (let i = 0; i < decibels.length; i += 1) magnitudes[i] = 10 ** (Math.max(decibels[i], -140) / 20);
    return chromaFromSpectrum(magnitudes, sampleRate, analyser.fftSize);
  }

  return {
    tick() {
      const time = now();
      const rms = measure();
      if (time - lastLevel >= LEVEL_EVERY_MS) { lastLevel = time; onLevel?.(rms); }

      if (!capture && rms > MIN_RMS && rms > floor * ONSET_RATIO && rms > previous * ONSET_RISE && time - lastOnset > REFRACTORY_MS) {
        capture = { onset: time, frames: [], peak: rms };
        lastOnset = time;
      }
      if (capture) {
        capture.peak = Math.max(capture.peak, rms);
        const age = time - capture.onset;
        if (age >= SETTLE_MS && age < SETTLE_MS + COLLECT_MS) capture.frames.push(readChroma());
        if (age >= SETTLE_MS + COLLECT_MS) {
          const { onset, frames, peak } = capture;
          capture = null;
          if (frames.length > 0) {
            const result = detectChord(averageChroma(frames), vocabulary);
            onStrum({ perf: onset, chord: result.name, confidence: chordConfidence(result), level: peak });
          }
        }
      } else {
        floor = rms < floor ? rms * 0.2 + floor * 0.8 : floor * 0.98 + rms * 0.02;
      }
      previous = rms;
    },
  };
}

export { ACCEPT_CONFIDENCE };
