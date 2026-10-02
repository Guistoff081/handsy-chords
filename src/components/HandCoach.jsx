import { Check, Warning, X } from "@phosphor-icons/react";
import { CHORDS } from "../data/chords.js";
import { compareFingers, describeComparison, fingersForChord } from "../vision/handMetrics.js";
import { ChordDiagram } from "./ChordDiagram.jsx";

const CAMERA_OFF = { enabled: false, status: "off", present: false, score: 0, pressed: [], calibrated: false, calibration: { status: "none", progress: 0, message: "" }, fingers: [], summary: "" };

function liveCorrection(camera, target) {
  if (camera.status === "loading") return { text: "CARREGANDO O MODELO DA MÃO…", tone: "wait" };
  if (camera.status !== "ready") return { text: "PERMITA O USO DA CÂMERA", tone: "wait" };
  if (!camera.present) return { text: "MOSTRE A MÃO DO BRAÇO À CÂMERA", tone: "wait" };
  if (camera.calibrated && camera.fingers.length > 0) {
    return { text: camera.summary, tone: camera.fingers.every((row) => row.status === "ok") ? "ok" : "fix" };
  }
  const comparison = compareFingers(camera.pressed, fingersForChord(target));
  return { text: describeComparison(comparison), tone: comparison.status === "ok" ? "ok" : "fix" };
}

const ICONS = { ok: Check, "far-from-fret": Warning, "on-fret": Warning };

function FingerFeedback({ rows }) {
  return (
    <ul className="finger-feedback" aria-label="Conferência por dedo">
      {rows.map((row) => {
        const Icon = ICONS[row.status] ?? X;
        return (
          <li key={row.finger} data-status={row.status}>
            <Icon weight="bold" aria-hidden="true" />
            <span>{row.message}</span>
          </li>
        );
      })}
    </ul>
  );
}

function Calibration({ camera, onCalibrate, onCancelCalibration }) {
  const { status, progress, message } = camera.calibration;
  if (status === "collecting") {
    return (
      <div className="calibration" data-status="collecting">
        <p>Faça o <strong>G</strong> e segure parado.</p>
        <progress aria-label="Leitura do braço" max="100" value={Math.round(progress * 100)} />
        <button type="button" onClick={onCancelCalibration}>Cancelar</button>
      </div>
    );
  }
  if (status === "failed") {
    return (
      <div className="calibration" data-status="failed">
        <p role="status">{message}</p>
        <button type="button" onClick={onCalibrate}>Tentar de novo</button>
      </div>
    );
  }
  if (camera.calibrated) {
    return (
      <div className="calibration" data-status="ready">
        <p>Braço calibrado. Se o violão ou a câmera mexer, calibre de novo.</p>
        <button type="button" onClick={onCalibrate}>Recalibrar</button>
      </div>
    );
  }
  return (
    <div className="calibration" data-status="none">
      <p>Para dizer a casa e a corda de cada dedo, calibre o braço: faça o <strong>G</strong> e segure parado.</p>
      <button type="button" onClick={onCalibrate} disabled={!camera.present}>Calibrar braço</button>
    </div>
  );
}

export function HandCoach({ chord = "Em", camera = CAMERA_OFF, videoRef, overlayRef, lowOnTop = true, onCalibrate, onCancelCalibration }) {
  const target = CHORDS[chord];
  const live = camera.enabled;
  const ready = live && camera.status === "ready";
  const correction = live ? liveCorrection(camera, target) : { text: "DEDO 3 · MAIS PERTO DO TRASTE", tone: "fix" };

  return (
    <aside className="hand-coach" data-live={live} aria-label="Orientação de mão">
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
        <figcaption>{live ? (ready ? "Câmera ao vivo · sua mão" : "Câmera ao vivo · iniciando") : "Câmera simulada · posição observada"}</figcaption>
        {ready && camera.calibrated && camera.fingers.length > 0 && <FingerFeedback rows={camera.fingers} />}
        {ready && onCalibrate && <Calibration camera={camera} onCalibrate={onCalibrate} onCancelCalibration={onCancelCalibration} />}
      </figure>
    </aside>
  );
}
