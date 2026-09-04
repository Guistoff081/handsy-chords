export const CHORDS = {
  Em: {
    name: "Em",
    strings: [
      { name: "E", fret: 0, finger: null },
      { name: "A", fret: 2, finger: 2 },
      { name: "D", fret: 2, finger: 3 },
      { name: "G", fret: 0, finger: null },
      { name: "B", fret: 0, finger: null },
      { name: "e", fret: 0, finger: null },
    ],
  },
  G: {
    name: "G",
    strings: [
      { name: "E", fret: 3, finger: 2 },
      { name: "A", fret: 2, finger: 1 },
      { name: "D", fret: 0, finger: null },
      { name: "G", fret: 0, finger: null },
      { name: "B", fret: 0, finger: null },
      { name: "e", fret: 3, finger: 3 },
    ],
  },
};

export function getChord(name) {
  if (!Object.hasOwn(CHORDS, name)) throw new Error(`Acorde desconhecido: ${name}`);
  return CHORDS[name];
}
