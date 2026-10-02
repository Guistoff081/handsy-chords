import { describe, expect, it } from "vitest";
import { ACCEPT_CONFIDENCE, chordConfidence, chromaFromSpectrum, detectChord, frequencyToPitchClass } from "../src/audio/chordDetector.js";
import { OPEN_VOICINGS, magnitudeSpectrum, pluckedStrum, synthChord } from "./helpers/synth.js";

const SAMPLE_RATE = 44_100;
const SIZE = 16_384;

function listen(name, options) {
  const samples = synthChord(OPEN_VOICINGS[name], { sampleRate: SAMPLE_RATE, length: SIZE, ...options });
  return detectChord(chromaFromSpectrum(magnitudeSpectrum(samples), SAMPLE_RATE, SIZE));
}

describe("chord detector", () => {
  it.each([[440, 9], [82.41, 4], [261.63, 0], [466.16, 10]])("maps %f Hz to pitch class %i", (hz, pitchClass) => {
    expect(frequencyToPitchClass(hz)).toBe(pitchClass);
  });

  it.each(Object.keys(OPEN_VOICINGS))("recognises the open %s chord", (name) => {
    const result = listen(name);
    expect(result.name).toBe(name);
    expect(chordConfidence(result)).toBeGreaterThan(0.7);
  });

  it("still recognises every open chord under heavy background noise", () => {
    for (const name of Object.keys(OPEN_VOICINGS)) {
      const result = listen(name, { noise: 15 });
      expect(result.name).toBe(name);
      expect(chordConfidence(result)).toBeGreaterThan(ACCEPT_CONFIDENCE);
    }
  });

  it("lowers its confidence below the acceptance threshold when the signal drowns in noise", () => {
    for (const name of Object.keys(OPEN_VOICINGS)) {
      const result = listen(name, { noise: 40 });
      if (result.name !== name) expect(chordConfidence(result)).toBeLessThan(ACCEPT_CONFIDENCE);
    }
  });

  it("tells major from minor on the same root", () => {
    expect(listen("A").name).toBe("A");
    expect(listen("Am").name).toBe("Am");
  });

  it("reports nothing for silence", () => {
    const silent = chromaFromSpectrum(new Float32Array(SIZE / 2), SAMPLE_RATE, SIZE);
    expect(detectChord(silent)).toEqual({ name: null, score: 0, margin: 0 });
  });
});

describe("vocabulary-restricted detection", () => {
  it("chooses only among the given chords, so an E-major-like spectrum resolves to Em when E is not on the song", () => {
    const samples = synthChord([...OPEN_VOICINGS.Em, 415.3], { sampleRate: SAMPLE_RATE, length: SIZE });
    const chroma = chromaFromSpectrum(magnitudeSpectrum(samples), SAMPLE_RATE, SIZE);
    expect(detectChord(chroma, ["Em", "G"]).name).toBe("Em");
  });

  it("returns nothing for an empty or unknown vocabulary", () => {
    const chroma = chromaFromSpectrum(magnitudeSpectrum(synthChord(OPEN_VOICINGS.Em, { length: SIZE })), SAMPLE_RATE, SIZE);
    expect(detectChord(chroma, ["Zz"]).name).toBeNull();
  });
});

describe("plucked strings", () => {
  // A low E string rings with a G# partial stronger than its own fundamental, which fooled the
  // unrestricted detector into hearing E major. Resolving among the song's chords must not.
  it.each(["Em", "G"])("names a strummed %s among the chords of the song", (name) => {
    const strum = pluckedStrum(OPEN_VOICINGS[name], { sampleRate: SAMPLE_RATE });
    const window = strum.slice(strum.length - SIZE);
    const chroma = chromaFromSpectrum(magnitudeSpectrum(window), SAMPLE_RATE, SIZE);
    const result = detectChord(chroma, ["Em", "G"]);
    expect(result.name).toBe(name);
    expect(chordConfidence(result)).toBeGreaterThan(ACCEPT_CONFIDENCE);
  });
});
