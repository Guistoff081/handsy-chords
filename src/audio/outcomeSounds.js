import { runningAudioContext } from "./lightningSound.js";

// Short synthesised cues for each verdict. Everything is built from oscillators and filtered noise,
// so there are no sample files to license. The boo is a gentle vowel-like glide, off unless asked for.

function envelope(gain, now, peak, attack, length) {
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(peak, now + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + length);
}

function tone(context, nodes, { type, from, to, peak, attack = 0.005, length, at = 0 }) {
  const now = context.currentTime + at;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(from, now);
  if (to) oscillator.frequency.exponentialRampToValueAtTime(to, now + length);
  envelope(gain, now, peak, attack, length);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + length + 0.02);
  nodes.push(oscillator, gain);
}

function noise(context, nodes, { peak, length, cutoff }) {
  const now = context.currentTime;
  const buffer = context.createBuffer(1, Math.max(1, Math.floor(context.sampleRate * length)), context.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < samples.length; i += 1) samples[i] = Math.random() * 2 - 1;
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  source.buffer = buffer;
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(cutoff, now);
  envelope(gain, now, peak, 0.004, length);
  source.connect(filter).connect(gain).connect(context.destination);
  source.start(now);
  source.stop(now + length);
  nodes.push(source, filter, gain);
}

function boo(context, nodes) {
  const now = context.currentTime;
  const length = 0.95;
  const voice = context.createOscillator();
  const vibrato = context.createOscillator();
  const vibratoDepth = context.createGain();
  const formantLow = context.createBiquadFilter();
  const formantHigh = context.createBiquadFilter();
  const gain = context.createGain();
  voice.type = "sawtooth";
  voice.frequency.setValueAtTime(205, now);
  voice.frequency.exponentialRampToValueAtTime(150, now + length);
  vibrato.frequency.setValueAtTime(5.5, now);
  vibratoDepth.gain.setValueAtTime(5, now);
  formantLow.type = "bandpass";
  formantLow.frequency.setValueAtTime(320, now);
  formantLow.Q.setValueAtTime(5, now);
  formantHigh.type = "bandpass";
  formantHigh.frequency.setValueAtTime(760, now);
  formantHigh.Q.setValueAtTime(6, now);
  envelope(gain, now, 0.2, 0.18, length);
  vibrato.connect(vibratoDepth).connect(voice.frequency);
  voice.connect(formantLow).connect(gain);
  voice.connect(formantHigh).connect(gain);
  gain.connect(context.destination);
  voice.start(now);
  vibrato.start(now);
  voice.stop(now + length + 0.02);
  vibrato.stop(now + length + 0.02);
  nodes.push(voice, vibrato, vibratoDepth, formantLow, formantHigh, gain);
}

const CUES = {
  hit: (context, nodes) => {
    tone(context, nodes, { type: "triangle", from: 880, peak: 0.1, length: 0.16 });
    tone(context, nodes, { type: "sine", from: 1320, peak: 0.06, length: 0.22, at: 0.03 });
  },
  late: (context, nodes) => tone(context, nodes, { type: "triangle", from: 520, to: 470, peak: 0.07, length: 0.2 }),
  miss: (context, nodes) => {
    tone(context, nodes, { type: "sine", from: 150, to: 52, peak: 0.28, length: 0.28 });
    noise(context, nodes, { peak: 0.1, length: 0.14, cutoff: 420 });
  },
  wrong: (context, nodes) => {
    tone(context, nodes, { type: "sine", from: 150, to: 52, peak: 0.24, length: 0.26 });
    // A detuned pair reads as "that chord is not it".
    tone(context, nodes, { type: "sawtooth", from: 196, peak: 0.04, length: 0.22 });
    tone(context, nodes, { type: "sawtooth", from: 208, peak: 0.04, length: 0.22 });
  },
};

/** Plays the cue for a verdict (hit, late, miss, wrong). Returns false when sound is not unlocked. */
export function playOutcomeSound(kind, { boo: withBoo = false } = {}) {
  const context = runningAudioContext();
  const cue = CUES[kind];
  if (!context || !cue) return false;
  const nodes = [];
  try {
    cue(context, nodes);
    if (withBoo && (kind === "miss" || kind === "wrong")) boo(context, nodes);
    window.setTimeout(() => nodes.forEach((node) => node.disconnect?.()), 1_300);
    return true;
  } catch {
    nodes.forEach((node) => node.disconnect?.());
    return false;
  }
}
