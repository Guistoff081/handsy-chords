// CSS-pixel coordinates: the renderer alone owns device-pixel scaling.
export const HIT_LINE = 0.75;
export const HORIZON = 0.08;

export function projectEvent(eventTimeMs, elapsedMs, viewport) {
  const remaining = eventTimeMs - elapsedMs;
  const progress = Math.max(0, Math.min(1, 1 - remaining / 5_000));
  return {
    x: viewport.width / 2,
    y: viewport.height * (HORIZON + (HIT_LINE - HORIZON) * progress ** 1.7),
    scale: 0.34 + 0.94 * progress,
    visible: remaining >= -220 && remaining <= 5_000,
  };
}
