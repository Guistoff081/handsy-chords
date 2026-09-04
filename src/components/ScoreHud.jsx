export function ScoreHud({ multiplier, score, streak, onDemonstrate, celebrating }) {
  const formattedScore = String(score).padStart(6, "0").replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return (
    <section className="score-hud amp-panel" aria-label="Pontuação" data-celebrating={celebrating}>
      <button className="score-demo" type="button" aria-label="Demonstrar multiplicador" title="Demonstrar multiplicador" onClick={onDemonstrate}>
        <span className="score-label">SCORE</span>
        <span className="score-value">{formattedScore}</span>
        <span className="score-streak">{streak} ACERTOS</span>
        <span className="score-multiplier"><small>x</small>{multiplier}</span>
      </button>
    </section>
  );
}
