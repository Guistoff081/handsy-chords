export function ScoreHud({ multiplier, score, streak }) {
  return (
    <section className="score-hud" aria-label="Pontuação">
      <p><span>PONTOS</span> {score.toLocaleString("pt-BR")}</p>
      <p><span>SEQUÊNCIA</span> {streak}</p>
      <p>{streak} ACERTOS</p>
      <p><span>MULTIPLICADOR</span> {multiplier}×</p>
    </section>
  );
}
