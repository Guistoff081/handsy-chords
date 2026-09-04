import { describe, expect, it } from "vitest";
import { getChord } from "../src/data/chords.js";

describe("canonical chord shapes", () => {
  it("maps Em to A2 with finger 2 and D2 with finger 3", () => {
    expect(getChord("Em")).toEqual({
      name: "Em",
      strings: [
        { name: "E", fret: 0, finger: null },
        { name: "A", fret: 2, finger: 2 },
        { name: "D", fret: 2, finger: 3 },
        { name: "G", fret: 0, finger: null },
        { name: "B", fret: 0, finger: null },
        { name: "e", fret: 0, finger: null },
      ],
    });
  });

  it("maps G to low E3, A2, and high e3", () => {
    expect(getChord("G")).toEqual({
      name: "G",
      strings: [
        { name: "E", fret: 3, finger: 2 },
        { name: "A", fret: 2, finger: 1 },
        { name: "D", fret: 0, finger: null },
        { name: "G", fret: 0, finger: null },
        { name: "B", fret: 0, finger: null },
        { name: "e", fret: 3, finger: 3 },
      ],
    });
  });

  it.each(["C", "toString"])("rejects unsupported chord %s", (name) => {
    expect(() => getChord(name)).toThrow(`Acorde desconhecido: ${name}`);
  });
});
