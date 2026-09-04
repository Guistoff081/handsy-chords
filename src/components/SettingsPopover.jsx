const EFFECTS = [
  ["smoke", "Fumaça"],
  ["lightning", "Efeito elétrico"],
  ["sound", "Som elétrico"],
  ["reducedMotion", "Reduzir movimento"],
];

export function SettingsPopover({ effects, onToggle, soundUnavailable = false }) {
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
    </section>
  );
}
