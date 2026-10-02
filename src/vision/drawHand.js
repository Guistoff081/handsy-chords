const CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];
const TIPS = { 1: 8, 2: 12, 3: 16, 4: 20 };
const CYAN = "#38d6e8";
const MAGENTA = "#e24a8d";
const AMBER = "#f4b942";

/**
 * Draws the tracked hand over the video. Fingertips say what the chord needs:
 * cyan = needed and pressing, magenta ring = needed but not pressing, amber = pressing but not needed.
 * `landmarks` are normalised image coordinates (0..1).
 */
export function drawHand(canvas, landmarks, { pressed = [], expected = [], marks = true } = {}) {
  const context = canvas?.getContext?.("2d");
  if (!context) return;
  const { width, height } = canvas;
  context.clearRect(0, 0, width, height);
  if (!landmarks) return;

  const at = (index) => [landmarks[index].x * width, landmarks[index].y * height];
  context.lineWidth = Math.max(2, width / 220);
  context.strokeStyle = `${CYAN}aa`;
  CONNECTIONS.forEach(([from, to]) => {
    const [x1, y1] = at(from);
    const [x2, y2] = at(to);
    context.beginPath();
    context.moveTo(x1, y1);
    context.lineTo(x2, y2);
    context.stroke();
  });
  context.fillStyle = "#e8edf7";
  landmarks.forEach((_, index) => {
    const [x, y] = at(index);
    context.beginPath();
    context.arc(x, y, Math.max(2, width / 260), 0, Math.PI * 2);
    context.fill();
  });

  if (!marks) return;
  const radius = Math.max(7, width / 48);
  Object.entries(TIPS).forEach(([finger, index]) => {
    const number = Number(finger);
    const needed = expected.includes(number);
    const down = pressed.includes(number);
    if (!needed && !down) return;
    const [x, y] = at(index);
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    if (needed && down) { context.fillStyle = CYAN; context.fill(); }
    else { context.lineWidth = Math.max(3, width / 160); context.strokeStyle = needed ? MAGENTA : AMBER; context.stroke(); }
  });
}
