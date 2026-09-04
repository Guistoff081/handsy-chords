import { getChord } from "../data/chords.js";
import { ChordDiagram } from "./ChordDiagram.jsx";

export function NextChordPanel({ cue, nextCue }) {
  const currentChord = getChord(cue.chord);
  const nextChord = getChord(nextCue?.chord ?? cue.chord);

  return (
    <aside className="next-chord-panel" aria-label="Próximo acorde">
      <div className="next-chord-current">
        <p>AGORA</p>
        <strong>{currentChord.name}</strong>
        <ChordDiagram chord={currentChord} width={180} height={110} showObserved={false} />
      </div>
      <div className="next-chord-upcoming">
        <p>PRÓXIMO</p>
        <strong>{nextChord.name}</strong>
        <ChordDiagram chord={nextChord} width={180} height={110} showObserved={false} />
      </div>
    </aside>
  );
}
