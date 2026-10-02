import { Check, Microphone, WarningCircle, X } from "@phosphor-icons/react";
import { INPUT_FAILURES, INPUT_MESSAGES } from "../practice/inputMessages.js";

export function LiveStatus({ input, expectedChord }) {
  const failed = INPUT_FAILURES.includes(input.status);
  if (!input.enabled && !failed) return null;

  if (failed) {
    return (
      <section className="live-status" aria-label="Entrada ao vivo" data-state="failed">
        <WarningCircle weight="fill" aria-hidden="true" />
        <p role="status">{INPUT_MESSAGES[input.status]}</p>
      </section>
    );
  }

  const meter = Math.min(1, input.level * 4);
  const heard = input.heard;
  const matches = heard?.chord === expectedChord;
  let message = INPUT_MESSAGES.requesting;
  if (input.status === "listening") message = heard?.chord ? `Ouvi ${heard.chord} · ${Math.round(heard.confidence * 100)}%` : "Ouvindo. Toque o acorde.";

  return (
    <section className="live-status" aria-label="Entrada ao vivo" data-state={input.status}>
      <Microphone weight="fill" aria-hidden="true" />
      <span className="live-meter" aria-hidden="true"><i style={{ width: `${Math.round(meter * 100)}%` }} /></span>
      <p role="status">{message}</p>
      {input.status === "listening" && heard?.chord && (
        <span className="live-match" data-match={matches}>
          {matches ? <Check weight="bold" aria-hidden="true" /> : <X weight="bold" aria-hidden="true" />}
          {matches ? "Certo" : `Toque ${expectedChord}`}
        </span>
      )}
    </section>
  );
}
