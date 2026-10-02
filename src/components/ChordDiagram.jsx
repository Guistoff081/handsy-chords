import { useEffect, useRef, useState } from "react";

// `lowOnTop`: the low E string is the top row, as the strings sit on the guitar; false gives the tablature layout (high e on top).
export function drawChordDiagram(context, chord, { width, height, showObserved = true, lowOnTop = true }) {
  if (!context || width <= 0 || height <= 0) return;

  const left = width * 0.18;
  const right = width * 0.96;
  const top = height * 0.2;
  const bottom = height * 0.88;
  const fretWidth = (right - left) / 3;
  const stringSpacing = (bottom - top) / 5;
  const radius = Math.min(fretWidth * 0.12, stringSpacing * 0.36);
  const strings = lowOnTop ? chord.strings : [...chord.strings].reverse();

  context.save();
  context.clearRect(0, 0, width, height);
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = `500 ${height * 0.07}px "Barlow Condensed", sans-serif`;

  strings.forEach((string, index) => {
    const y = top + index * stringSpacing;
    context.strokeStyle = "#89969f";
    context.lineWidth = Math.max(0.7, height * (0.003 + index * 0.0005));
    context.beginPath();
    context.moveTo(left, y);
    context.lineTo(right, y);
    context.stroke();
    context.fillStyle = "#e4edf2";
    context.fillText(string.name, width * 0.055, y);
  });

  for (let fret = 0; fret <= 3; fret += 1) {
    const x = left + fret * fretWidth;
    context.strokeStyle = "#b2bec6";
    context.lineWidth = height * (fret === 0 ? 0.012 : 0.005);
    context.beginPath();
    context.moveTo(x, top);
    context.lineTo(x, bottom);
    context.stroke();
    if (fret > 0) {
      context.fillStyle = "#b2bec6";
      context.fillText(String(fret), x - fretWidth / 2, height * 0.08);
    }
  }

  strings.forEach((string, index) => {
    const y = top + index * stringSpacing;
    if (string.fret === 0) {
      context.strokeStyle = "#b2bec6";
      context.lineWidth = Math.max(1, height * 0.006);
      context.beginPath();
      context.arc(width * 0.12, y, radius * 0.55, 0, Math.PI * 2);
      context.stroke();
      return;
    }

    // The teaching target sits just behind the fret; the observation is nearer its center.
    const x = left + (string.fret - 0.16) * fretWidth;
    if (showObserved) {
      context.strokeStyle = "#ff4f88";
      context.lineWidth = Math.max(1, height * 0.009);
      context.beginPath();
      context.arc(left + (string.fret - 0.5) * fretWidth, y, radius, 0, Math.PI * 2);
      context.stroke();
    }
    context.fillStyle = "#15d9f5";
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#06151d";
    context.font = `600 ${radius * 1.5}px "Barlow Condensed", sans-serif`;
    context.fillText(String(string.finger), x, y);
  });
  context.restore();
}

function describeChord(chord) {
  const fingers = chord.strings
    .filter(({ fret }) => fret > 0)
    .map(({ name, fret, finger }) => `dedo ${finger} na corda ${name}, casa ${fret}`)
    .join("; ");
  return `Acorde ${chord.name}: ${fingers}; demais cordas soltas.`;
}

export function ChordDiagram({ chord, width = 360, height = 220, showObserved = true, lowOnTop = true }) {
  const canvasRef = useRef(null);
  const [unavailable, setUnavailable] = useState(false);
  const description = describeChord(chord);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    setUnavailable(!context);
    if (!context) return;

    function redraw() {
      const displayWidth = canvas.getBoundingClientRect().width || width;
      const displayHeight = displayWidth * height / width;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(displayWidth * ratio);
      canvas.height = Math.round(displayHeight * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      drawChordDiagram(context, chord, { width: displayWidth, height: displayHeight, showObserved, lowOnTop });
    }

    redraw();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(redraw);
    observer?.observe(canvas);
    window.addEventListener("resize", redraw);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", redraw);
    };
  }, [chord, width, height, showObserved, lowOnTop]);

  return (
    <div className="chord-diagram">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={description}
        width={width}
        height={height}
        style={{ display: "block", width: "100%", aspectRatio: `${width} / ${height}` }}
      >
        {description}
      </canvas>
      {unavailable && <p className="chord-diagram-fallback">{description}</p>}
    </div>
  );
}
