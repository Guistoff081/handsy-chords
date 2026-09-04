import { Waveform, Hand, Microphone, WarningCircle } from "@phosphor-icons/react";

const LAYERS = [
  ["track", "Trilha", Waveform],
  ["lyrics", "Letra", Microphone],
  ["hand", "Mão", Hand],
];

export function LayerControls({ layers, onToggle }) {
  return (
    <section className="layer-controls" aria-label="Camadas de orientação">
      {LAYERS.map(([key, label, Icon]) => (
        <button
          key={key}
          type="button"
          className="layer-toggle"
          aria-label={label}
          aria-pressed={layers[key]}
          onClick={() => onToggle(key)}
        >
          <Icon weight="fill" aria-hidden="true" />
          <span>{label.toUpperCase()}</span>
          {key === "hand" && <WarningCircle className="alert-dot" weight="fill" aria-label="Correção disponível" />}
        </button>
      ))}
    </section>
  );
}
