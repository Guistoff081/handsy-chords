export function LyricsLayer({ cue }) {
  return (
    <section className="lyrics-layer" aria-label="Letra atual">
      <p className="current-lyric">{cue.current}</p>
      <p className="next-lyric">{cue.next}</p>
    </section>
  );
}
