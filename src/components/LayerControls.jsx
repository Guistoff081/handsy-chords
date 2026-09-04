import { Guitar, Hand, TextAlignLeft } from "@phosphor-icons/react";

const LAYERS = [
  ["track", "Trilha", Guitar],
  ["lyrics", "Letra", TextAlignLeft],
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
          {key === "hand" && <i className="alert-dot" aria-label="Correção disponível" />}
        </button>
      ))}
    </section>
  );
}
