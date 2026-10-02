import { CHORDS } from "../data/chords.js";
import { compareFingers, describeComparison, fingersForChord } from "../vision/handMetrics.js";
import { ChordDiagram } from "./ChordDiagram.jsx";

const CAMERA_OFF = { enabled: false, status: "off", present: false, score: 0, pressed: [] };

function liveCorrection(camera, target) {
  if (camera.status === "loading") return { text: "CARREGANDO O MODELO DA MÃO…", tone: "wait" };
  if (camera.status !== "ready") return { text: "PERMITA O USO DA CÂMERA", tone: "wait" };
  if (!camera.present) return { text: "MOSTRE A MÃO DO BRAÇO À CÂMERA", tone: "wait" };
  const comparison = compareFingers(camera.pressed, fingersForChord(target));
  return { text: describeComparison(comparison), tone: comparison.status === "ok" ? "ok" : "fix" };
}

export function HandCoach({ chord = "Em", camera = CAMERA_OFF, videoRef, overlayRef, lowOnTop = true }) {
  const target = CHORDS[chord];
  const live = camera.enabled;
  const correction = live ? liveCorrection(camera, target) : { text: "DEDO 3 · MAIS PERTO DO TRASTE", tone: "fix" };

  return (
    <aside className="hand-coach" aria-label="Orientação de mão">
      <section className="hand-coach-monitor amp-panel" aria-label={`Posição alvo de ${target.name}`}>
        <h2 className="hand-coach-chord">{target.name}</h2>
        <ChordDiagram chord={target} showObserved={!live} lowOnTop={lowOnTop} />
        <div className="hand-coach-legend">
          <span className="hand-coach-target"><i aria-hidden="true" />ALVO</span>
          {!live && <span className="hand-coach-observed"><i aria-hidden="true" />AGORA</span>}
        </div>
        <p className="hand-coach-correction" data-tone={correction.tone} role="status">{correction.text}</p>
      </section>
      <figure className="hand-coach-camera amp-panel">
        {live ? (
          <div className="hand-coach-feed">
            <video ref={videoRef} muted playsInline aria-label="Imagem ao vivo da câmera, espelhada" />
            <canvas ref={overlayRef} aria-hidden="true" />
          </div>
        ) : (
          <img src={`${import.meta.env.BASE_URL}assets/hand-camera.webp`} alt="Mão observada na câmera simulada, com posição a corrigir" />
        )}
        <figcaption>{live ? (camera.status === "ready" ? "Câmera ao vivo · sua mão" : "Câmera ao vivo · iniciando") : "Câmera simulada · posição observada"}</figcaption>
      </figure>
    </aside>
  );
}
