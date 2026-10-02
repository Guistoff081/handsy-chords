import { INPUT_FAILURES, INPUT_MESSAGES } from "../practice/inputMessages.js";

const EFFECTS = [
  ["smoke", "Fumaça"],
  ["lightning", "Efeito elétrico"],
  ["sound", "Som elétrico"],
  ["reducedMotion", "Reduzir movimento"],
];

export function SettingsPopover({ effects, onToggle, soundUnavailable = false, input, onToggleInput }) {
  return (
    <section className="settings-popover" aria-label="Configurações de efeitos">
      <h2>Configurações</h2>
      {EFFECTS.map(([key, label]) => (
        <label key={key}>
          <input
            type="checkbox"
            checked={effects[key]}
            onChange={() => onToggle(key)}
          />
          {label}
        </label>
      ))}
      {soundUnavailable && <p role="status">Som indisponível</p>}
      {onToggleInput && (
        <>
          <h3>Entrada ao vivo</h3>
          <label>
            <input type="checkbox" checked={input.enabled} onChange={onToggleInput} />
            Microfone: reconhecer o acorde que você toca
          </label>
          {(input.status === "requesting" || INPUT_FAILURES.includes(input.status)) && (
            <p role="status">{INPUT_MESSAGES[input.status]}</p>
          )}
        </>
      )}
    </section>
  );
}
