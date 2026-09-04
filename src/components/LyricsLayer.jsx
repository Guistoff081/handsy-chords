export function LyricsLayer({ cue }) {
  return (
    <section className="lyrics-layer" aria-label="Letra atual">
      <p className="lyric-chord">{cue.chord}</p>
      <p className="current-lyric">{cue.current}</p>
      <p className="next-lyric">{cue.next}</p>
    </section>
  );
}
