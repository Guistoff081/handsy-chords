import { useEffect, useRef, useState } from "react";
import { HIT_LINE, HORIZON, projectEvent } from "./highwayGeometry.js";

const CYAN = "#35dfff";
const AMBER = "#efb65c";

function halfWidth(y, { width, height }) {
  return width * (0.105 + 0.375 * Math.max(0, (y / height - HORIZON) / (1 - HORIZON)));
}

function line(context, x1, y1, x2, y2) {
  context.beginPath();
  context.moveTo(x1, y1);
  context.lineTo(x2, y2);
  context.stroke();
}

function band(context, viewport, y1, y2) {
  const center = viewport.width / 2;
  context.beginPath();
  context.moveTo(center - halfWidth(y1, viewport), y1);
  context.lineTo(center + halfWidth(y1, viewport), y1);
  context.lineTo(center + halfWidth(y2, viewport), y2);
  context.lineTo(center - halfWidth(y2, viewport), y2);
  context.closePath();
}

function drawHighway(context, viewport, props, phase, celebrationStart) {
  const { width, height } = viewport;
  const center = width / 2;
  const top = height * HORIZON;
  const hit = height * HIT_LINE;
  context.clearRect(0, 0, width, height);
  context.save();
  const neck = context.createLinearGradient(0, top, 0, height);
  neck.addColorStop(0, "rgba(3, 11, 17, 0.3)");
  neck.addColorStop(1, "rgba(3, 11, 17, 0.94)");
  band(context, viewport, top, height);
  context.fillStyle = neck;
  context.fill();

  // Six actual strings on a tapered neck, bounded by a separate pair of rails.
  for (let string = 0; string < 6; string += 1) {
    const lane = (string / 5 * 2 - 1) * 0.86;
    context.strokeStyle = string < 3 ? "rgba(192, 171, 145, 0.52)" : "rgba(170, 195, 203, 0.52)";
    context.lineWidth = 0.9 + string * 0.17;
    line(context, center + lane * halfWidth(top, viewport), top, center + lane * halfWidth(height, viewport), height);
  }

  // Phase is accumulated only while running, independently of React clock updates.
  const drift = props.reducedMotion ? 0 : (phase / 3_500) % 1;
  for (let fret = 0; fret < 19; fret += 1) {
    const depth = ((fret + drift) / 19) ** 1.8;
    const y = top + (height - top) * depth;
    context.strokeStyle = `rgba(160, 191, 206, ${0.1 + depth * 0.23})`;
    context.lineWidth = 1;
    line(context, center - halfWidth(y, viewport), y, center + halfWidth(y, viewport), y);
  }
  context.strokeStyle = CYAN;
  context.shadowColor = CYAN;
  context.shadowBlur = 12;
  context.lineWidth = 2;
  for (const side of [-1, 1]) {
    line(context, center + side * halfWidth(top, viewport), top, center + side * halfWidth(height, viewport), height);
  }
  context.shadowBlur = 0;

  if (props.visible) {
    // Farthest first so nearer marks naturally cover farther ones.
    for (const event of [...props.events].sort((a, b) => b.atMs - a.atMs)) {
      const point = projectEvent(event.atMs, props.elapsedMs, viewport);
      if (!point.visible) continue;
      const size = Math.max(7, Math.min(width / 30, 23)) * point.scale;
      const eventWidth = halfWidth(point.y, viewport);
      context.fillStyle = AMBER;
      context.strokeStyle = AMBER;
      context.shadowColor = AMBER;
      context.shadowBlur = 9;
      if (event.kind === "chord") {
        band(context, viewport, point.y - size * 1.25, point.y + size * 1.25);
        context.fillStyle = "rgba(125, 77, 20, 0.42)";
        context.fill();
        context.lineWidth = 1.8;
        context.stroke();
        context.fillStyle = AMBER;
        context.font = `600 ${Math.max(16, size * 1.6)}px 'Barlow Condensed', sans-serif`;
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(event.chord, center, point.y);
        context.fillText(event.direction === "up" ? "↑" : "↓", center + eventWidth * 0.7, point.y);
      } else {
        const lane = (Math.max(0, Math.min(5, event.string ?? 0)) / 5 * 2 - 1) * 0.86;
        const x = center + lane * eventWidth;
        context.beginPath();
        context.ellipse(x, point.y + size * 0.16, size, size * 0.46, 0, 0, Math.PI * 2);
        context.fillStyle = "#765023";
        context.fill();
        context.beginPath();
        context.ellipse(x, point.y - size * 0.08, size, size * 0.4, 0, 0, Math.PI * 2);
        context.fillStyle = event.atMs - props.elapsedMs < 900 ? "#138ba8" : "#bf842f";
        context.strokeStyle = event.atMs - props.elapsedMs < 900 ? CYAN : AMBER;
        context.fill();
        context.stroke();
      }
    }
  }

  // Minimum timing feedback is retained even with TRILHA disabled.
  context.strokeStyle = "#b5f8ff";
  context.lineWidth = 3;
  context.shadowColor = CYAN;
  context.shadowBlur = 20;
  line(context, center - halfWidth(hit, viewport) * 1.07, hit, center + halfWidth(hit, viewport) * 1.07, hit);

  const age = phase - celebrationStart;
  if (props.celebrating && props.lightning && !props.reducedMotion && age < 900) {
    context.globalAlpha = Math.max(0, 1 - age / 900);
    context.lineWidth = 2;
    context.beginPath();
    context.arc(center, hit, halfWidth(hit, viewport) * (0.8 + age / 3_000), Math.PI * 1.1, Math.PI * 1.9);
    context.stroke();
    for (const side of [-1, 1]) {
      context.beginPath();
      const start = center + side * halfWidth(hit, viewport);
      context.moveTo(start, hit);
      for (let step = 1; step <= 7; step += 1) {
        context.lineTo(start + side * (step * width * 0.012 + (step % 2 ? width * 0.017 : 0)), hit - step * height * 0.027);
      }
      context.stroke();
    }
  }
  context.restore();
}

export function NoteHighway({ events = [], elapsedMs = 0, playing = false, visible = true, reducedMotion = false, celebrating = false, lightning = true }) {
  const canvasRef = useRef(null);
  const surface = useRef(null);
  const latest = useRef(null);
  const phase = useRef(0);
  const celebrationStart = useRef(0);
  const wasCelebrating = useRef(false);
  const [unavailable, setUnavailable] = useState(false);
  const draw = useRef(() => {});
  latest.current = { events, elapsedMs, visible, reducedMotion, celebrating, lightning };
  draw.current = () => {
    if (!surface.current) return;
    drawHighway(surface.current.context, surface.current.viewport, latest.current, phase.current, celebrationStart.current);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    if (!context) { setUnavailable(true); return; }
    function resize(entries) {
      const bounds = entries?.[0]?.contentRect ?? canvas.getBoundingClientRect();
      const viewport = { width: bounds.width || 760, height: bounds.height || 700 };
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(viewport.width * ratio);
      canvas.height = Math.round(viewport.height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      surface.current = { context, viewport };
      draw.current();
    }
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    return () => { observer.disconnect(); surface.current = null; };
  }, []);

  useEffect(() => {
    if (celebrating && !wasCelebrating.current) celebrationStart.current = phase.current;
    wasCelebrating.current = celebrating;
    draw.current();
  }, [events, elapsedMs, visible, reducedMotion, celebrating, lightning, playing]);

  useEffect(() => {
    if (!playing || reducedMotion || !surface.current) return;
    let frame;
    let previous;
    function animate(now) {
      if (previous !== undefined) phase.current += Math.max(0, now - previous);
      previous = now;
      draw.current();
      frame = requestAnimationFrame(animate);
    }
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [playing, reducedMotion]);

  return (
    <div className="note-highway">
      <canvas ref={canvasRef} aria-label="Pista de seis cordas e linha de acerto" role="img" style={{ display: "block", width: "100%", height: "100%" }} />
      {unavailable && <p className="canvas-fallback">Pista visual indisponível. Acompanhe os acordes e o retorno de tempo.</p>}
    </div>
  );
}
