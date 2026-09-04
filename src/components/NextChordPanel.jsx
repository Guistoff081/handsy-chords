export function NextChordPanel({ cue, nextCue }) {
  return (
    <aside className="next-chord-panel" aria-label="Próximo acorde">
      <p>AGORA</p>
      <strong>{cue.chord}</strong>
      <p>PRÓXIMO</p>
      <strong>{nextCue?.chord ?? cue.chord}</strong>
    </aside>
  );
}
