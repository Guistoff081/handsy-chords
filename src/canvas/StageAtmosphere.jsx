import { useEffect, useRef } from "react";

// Shared across mounts and preference changes: one browser image/decode request.
let smokeImage;
function getSmokeImage() {
  if (!smokeImage) {
    smokeImage = new Image();
    smokeImage.src = "/assets/smoke-wisp.png";
  }
  return smokeImage;
}

export function StageAtmosphere({ smoke = true, playing = false, reducedMotion = false }) {
  const canvasRef = useRef(null);
  const surface = useRef(null);
  const imageRef = useRef(null);
  const phase = useRef(0);
  const latest = useRef(null);
  const draw = useRef(() => {});
  latest.current = { smoke, reducedMotion };
  draw.current = () => {
    if (!surface.current) return;
    const { context, width, height } = surface.current;
    context.clearRect(0, 0, width, height);
    const image = imageRef.current;
    if (!latest.current.smoke || !image?.complete || !image.naturalWidth) return;
    const still = latest.current.reducedMotion;
    const seconds = still ? 0 : phase.current / 1_000;
    for (let index = 0; index < (still ? 1 : 2); index += 1) {
      const imageHeight = height * 0.93;
      const imageWidth = imageHeight * image.naturalWidth / image.naturalHeight;
      context.save();
      context.globalAlpha = still ? 0.12 : 0.16;
      context.translate(width * (index === 0 ? 0.79 : 0.22) + Math.sin(seconds / 11 + index) * width * 0.024, height * 0.62 + Math.sin(seconds / 14 + index) * height * 0.025);
      context.rotate((index === 0 ? -0.1 : 0.15) + Math.sin(seconds / 17) * 0.025);
      context.drawImage(image, -imageWidth / 2, -imageHeight / 2, imageWidth, imageHeight);
      context.restore();
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    if (!context) return;
    function resize(entries) {
      const bounds = entries?.[0]?.contentRect ?? canvas.getBoundingClientRect();
      const width = bounds.width || 760;
      const height = bounds.height || 700;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      surface.current = { context, width, height };
      draw.current();
    }
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    return () => { observer.disconnect(); surface.current = null; };
  }, []);

  useEffect(() => {
    if (!smoke || !surface.current) return;
    const image = getSmokeImage();
    imageRef.current = image;
    const onLoad = () => draw.current();
    image.addEventListener("load", onLoad);
    return () => image.removeEventListener("load", onLoad);
  }, [smoke]);

  useEffect(() => { draw.current(); });

  useEffect(() => {
    if (!smoke || !playing || reducedMotion || !surface.current) return;
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
  }, [smoke, playing, reducedMotion]);

  return <canvas className="stage-atmosphere" ref={canvasRef} aria-hidden="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} />;
}
