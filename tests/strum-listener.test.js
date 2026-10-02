import { describe, expect, it, vi } from "vitest";
import { createStrumListener, FFT_SIZE } from "../src/audio/strumListener.js";
import { OPEN_VOICINGS, magnitudeSpectrum, synthChord } from "./helpers/synth.js";

const SAMPLE_RATE = 44_100;

// An analyser whose content is scripted per tick: silence, then a strum of a given chord.
function fakeAnalyser() {
  const state = { chord: null, level: 0 };
  const spectra = new Map();
  return {
    state,
    fftSize: FFT_SIZE,
    frequencyBinCount: FFT_SIZE / 2,
    getFloatTimeDomainData(buffer) {
      buffer.fill(0);
      for (let i = 0; i < buffer.length; i += 1) buffer[i] = state.level * Math.sin(i * 0.31);
    },
    getFloatFrequencyData(buffer) {
      if (!state.chord) { buffer.fill(-140); return; }
      if (!spectra.has(state.chord)) {
        const samples = synthChord(OPEN_VOICINGS[state.chord], { sampleRate: SAMPLE_RATE, length: FFT_SIZE });
        const magnitudes = magnitudeSpectrum(samples);
        spectra.set(state.chord, Float32Array.from(magnitudes, (value) => 20 * Math.log10(Math.max(value, 1e-7) / 1_000)));
      }
      buffer.set(spectra.get(state.chord));
    },
  };
}

function run({ chord, ticks = 30 }) {
  const analyser = fakeAnalyser();
  let clock = 1_000;
  const onStrum = vi.fn();
  const onLevel = vi.fn();
  const listener = createStrumListener({ analyser, sampleRate: SAMPLE_RATE, now: () => clock, onStrum, onLevel });
  for (let i = 0; i < 10; i += 1) { clock += 25; listener.tick(); }
  const strumAt = clock + 25;
  analyser.state.chord = chord;
  analyser.state.level = chord ? 0.3 : 0;
  for (let i = 0; i < ticks; i += 1) { clock += 25; listener.tick(); }
  return { onStrum, onLevel, strumAt };
}

describe("strum listener", () => {
  it("reports the onset time and the chord of a strum once its window has been analysed", () => {
    const { onStrum, strumAt } = run({ chord: "Em" });
    expect(onStrum).toHaveBeenCalledTimes(1);
    const [strum] = onStrum.mock.calls[0];
    expect(strum.chord).toBe("Em");
    expect(strum.confidence).toBeGreaterThan(0.65);
    expect(strum.perf).toBe(strumAt);
  });

  it("names a different chord correctly", () => {
    expect(run({ chord: "G" }).onStrum.mock.calls[0][0].chord).toBe("G");
  });

  it("stays silent when nothing is played and keeps reporting the input level", () => {
    const { onStrum, onLevel } = run({ chord: null });
    expect(onStrum).not.toHaveBeenCalled();
    expect(onLevel).toHaveBeenCalled();
  });

  it("does not report a second strum inside the refractory period", () => {
    const { onStrum } = run({ chord: "Em", ticks: 40 });
    expect(onStrum).toHaveBeenCalledTimes(1);
  });
});
