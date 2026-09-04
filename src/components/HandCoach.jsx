import { CHORDS } from "../data/chords.js";
import { ChordDiagram } from "./ChordDiagram.jsx";

export function HandCoach() {
  return (
    <aside className="hand-coach" aria-label="Orientação de mão">
      <section className="hand-coach-monitor" aria-label="Posição alvo de Em">
        <h2 className="hand-coach-chord">{CHORDS.Em.name}</h2>
        <ChordDiagram chord={CHORDS.Em} />
        <div className="hand-coach-legend">
          <span className="hand-coach-target"><i aria-hidden="true" />ALVO</span>
          <span className="hand-coach-observed"><i aria-hidden="true" />AGORA</span>
        </div>
        <p className="hand-coach-correction">DEDO 3 · MAIS PERTO DO TRASTE</p>
      </section>
      <figure className="hand-coach-camera">
        <img src="/assets/hand-camera.webp" alt="Mão observada na câmera simulada, com posição a corrigir" />
        <figcaption>Câmera simulada · posição observada</figcaption>
      </figure>
    </aside>
  );
}
