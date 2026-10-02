const MODES = [
  ["learn", "Aprendizado"],
  ["challenge", "Desafio"],
];

export function ModeSwitch({ mode, onChange }) {
  return (
    <div className="mode-switch" role="group" aria-label="Modo de prática">
      {MODES.map(([key, label]) => (
        <button key={key} type="button" aria-pressed={mode === key} onClick={() => onChange(key)}>
          {label}
        </button>
      ))}
    </div>
  );
}
