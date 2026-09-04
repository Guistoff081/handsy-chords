export const DEMO_SONG = {
  title: "Come As You Are",
  section: "Verse 1",
  bpm: 92,
  durationMs: 218_000,
  excerpt: {
    startMs: 72_000,
    endMs: 80_000,
    label: "TRECHO EM LOOP · SIMULAÇÃO",
  },
  simulation: {
    cycleEvents: 25,
    missAt: 0,
    lateAt: 3,
  },
  lyrics: [
    { atMs: 72_000, chord: "Em", current: "Come as you are, as you were", next: "As I want you to be" },
    { atMs: 78_000, chord: "G", current: "As I want you to be", next: "As a friend, as a friend" },
  ],
  events: [
    { atMs: 74_650, kind: "note", string: 1 },
    { atMs: 75_300, kind: "note", string: 4 },
    { atMs: 76_000, kind: "chord", chord: "Em", direction: "down" },
    { atMs: 76_650, kind: "note", string: 2 },
    { atMs: 77_300, kind: "note", string: 5 },
  ],
};
