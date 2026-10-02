// Builds 21 MediaPipe-style world landmarks for a hand with the given fingers bent at the PIP joint.
const BASES = { 1: -0.03, 2: -0.01, 3: 0.01, 4: 0.03 };
const FIRST = { 1: 5, 2: 9, 3: 13, 4: 17 };
const SEGMENT = 0.035;

export function makeHand({ bent = [], bendDegrees = 95 } = {}) {
  const points = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }));
  points[0] = { x: 0, y: 0, z: 0 };
  [1, 2, 3, 4].forEach((finger) => {
    const first = FIRST[finger];
    const x = BASES[finger];
    points[first] = { x, y: 0.09, z: 0 };
    points[first + 1] = { x, y: 0.09 + SEGMENT, z: 0 };
    // Straight: continue along +y. Bent: the rest of the finger turns by (180 - bendDegrees) towards +z.
    const turn = bent.includes(finger) ? ((180 - bendDegrees) * Math.PI) / 180 : 0;
    const dy = Math.cos(turn) * SEGMENT;
    const dz = Math.sin(turn) * SEGMENT;
    points[first + 2] = { x, y: points[first + 1].y + dy, z: dz };
    points[first + 3] = { x, y: points[first + 2].y + dy, z: points[first + 2].z + dz };
  });
  return points;
}
