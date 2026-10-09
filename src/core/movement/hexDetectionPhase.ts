import { centralPhase, type ProfileFit } from './gridDetectionProfiles';

/** Verify complete edge segments to distinguish the honeycomb from its larger repeating patterns. */
export function chooseHexPhase(gray: Float32Array, width: number, height: number, rotation: number, profiles: ProfileFit[], offset: number) {
  const cell = profiles.reduce((sum, profile) => sum + profile.spacing, 0) * 2 / 3;
  const radius = cell / Math.sqrt(3), angle = rotation * Math.PI / 180;
  const a = (rotation + 30) * Math.PI / 180, b = (rotation + 90) * Math.PI / 180;
  const first = centralPhase(profiles[0].phase, profiles[0].spacing, offset);
  const second = centralPhase(profiles[1].phase, profiles[1].spacing, offset);
  const determinant = Math.cos(a) * Math.sin(b) - Math.sin(a) * Math.cos(b);
  const start = { x: width / 2 + (first * Math.sin(b) - second * Math.sin(a)) / determinant,
    y: height / 2 + (second * Math.cos(a) - first * Math.cos(b)) / determinant };
  const normalStrength = (x: number, y: number, nx: number, ny: number) => {
    const ix = Math.round(x), iy = Math.round(y);
    if (ix < 2 || iy < 2 || ix >= width - 2 || iy >= height - 2) return null;
    const dx = gray[iy * width + ix + 1] - gray[iy * width + ix - 1];
    const dy = gray[(iy + 1) * width + ix] - gray[(iy - 1) * width + ix];
    return Math.abs(dx * nx + dy * ny);
  };
  let origin = start, strongest = -1;
  // The projected line families contain three possible phases: two vertices and one center.
  for (let phase = 0; phase < 3; phase++) {
    const candidate = { x: start.x + phase * radius * Math.cos(angle), y: start.y + phase * radius * Math.sin(angle) };
    let strength = 0, count = 0;
    for (let q = -8; q <= 8; q++) for (let r = -8; r <= 8; r++) {
      const cx = q * 1.5 * radius, cy = (r + q / 2) * cell;
      for (let k = 0; k < 6; k++) {
        const normal = angle + (k + 0.5) * Math.PI / 3;
        const x = candidate.x + cx * Math.cos(angle) - cy * Math.sin(angle) + cell / 2 * Math.cos(normal);
        const y = candidate.y + cx * Math.sin(angle) + cy * Math.cos(angle) + cell / 2 * Math.sin(normal);
        const tangent = normal + Math.PI / 2;
        for (const fraction of [-0.25, 0, 0.25]) {
          const sx = x + radius * fraction * Math.cos(tangent), sy = y + radius * fraction * Math.sin(tangent);
          const values = [-1, 0, 1].map(offset => normalStrength(sx + offset * Math.cos(normal), sy + offset * Math.sin(normal), Math.cos(normal), Math.sin(normal))).filter(value => value !== null) as number[];
          if (values.length) { strength += Math.max(...values); count++; }
        }
      }
    }
    const score = strength / (count || 1);
    if (score > strongest) { strongest = score; origin = candidate; }
  }
  return { cell, origin, strength: strongest };
}
