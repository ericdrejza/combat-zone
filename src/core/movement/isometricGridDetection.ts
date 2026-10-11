import type { GridConfiguration } from './types';
import { calibratedRotation, normalizeGridRotation } from './gridRotation';
import { centralPhase, fitProfile, imageContrasts, lineProfile, refineProfileFit, type ProfileFit } from './gridDetectionProfiles';
import { imageRidges, ridgeProfile } from './gridDetectionRidges';

type Line = { angle: number; fit: ProfileFit };
type Pair = { lines: [Line, Line]; angle: number; rotation: number; score: number };
const rotationDistance = (a: number, b: number) => Math.min(Math.abs(a - b), 180 - Math.abs(a - b));

/** Estimate both oblique families: their separation determines projection independently of rotation. */
export function detectIsometricGrid(pixels: Uint8ClampedArray, width: number, height: number,
  canvasWidth: number, canvasHeight: number, grid: GridConfiguration): GridConfiguration | null {
  const { edges, gray } = imageContrasts(pixels, width, height);
  if (edges.length < 50) return null;
  const offset = Math.ceil(Math.hypot(width, height) / 2);
  let profile = (angle: number) => lineProfile(edges, offset, angle);
  function search(): Pair | null {
    const lines: Line[] = [];
    for (let angle = 0; angle < 180; angle++) {
      const fit = fitProfile(profile(angle));
      if (fit && fit.score >= 0.3) lines.push({ angle, fit });
    }
    // Adjacent angular samples of one family must not masquerade as two families.
    const peaks = lines.filter(line => !lines.some(other => other !== line &&
      rotationDistance(line.angle, other.angle) <= 1 && other.fit.score > line.fit.score));
    let best: Pair | null = null;
    for (let i = 0; i < peaks.length; i++) for (let j = i + 1; j < peaks.length; j++) {
      const a = peaks[i], b = peaks[j], separation = b.angle - a.angle;
      const angle = Math.min(separation, 180 - separation) / 2;
      if (angle < 1 || angle > 45 || Math.max(a.fit.spacing, b.fit.spacing) / Math.min(a.fit.spacing, b.fit.spacing) > 1.1) continue;
      const score = Math.min(a.fit.score, b.fit.score);
      const rotation = normalizeGridRotation((a.angle + b.angle + (separation > 90 ? 180 : 0)) / 2 - 90, 'isometric');
      // Three-family maps offer equally valid planes; prefer the current screen orientation.
      if (!best || score > best.score + 0.03 || (score >= best.score - 0.03 &&
        rotationDistance(rotation, normalizeGridRotation(grid.rotation, 'isometric')) < rotationDistance(best.rotation, normalizeGridRotation(grid.rotation, 'isometric')))) {
        best = { lines: [a, b], angle, rotation, score };
      }
    }
    return best;
  }
  let best = search();
  if (!best) {
    const ridges = imageRidges(gray, width, height);
    profile = angle => ridgeProfile(ridges, offset, angle);
    best = search();
  }
  if (!best) return null;
  const lines = best.lines.map(line => {
    let refined = line;
    for (let angle = line.angle - 0.75; angle <= line.angle + 0.75; angle += 0.125) {
      const fit = fitProfile(profile(angle));
      if (fit && fit.score > refined.fit.score && Math.max(fit.spacing, line.fit.spacing) / Math.min(fit.spacing, line.fit.spacing) < 1.1) refined = { angle, fit };
    }
    return { ...refined, fit: refineProfileFit(profile(refined.angle), refined.fit) };
  });
  const separation = lines[1].angle - lines[0].angle;
  const angle = Math.min(Math.abs(separation), 180 - Math.abs(separation)) / 2;
  if (angle < 1 || angle > 45) return null;
  const rotation = (lines[0].angle + lines[1].angle + (separation > 90 ? 180 : 0)) / 2 - 90;
  const normals = lines.map(line => line.angle * Math.PI / 180);
  const phases = lines.map(line => centralPhase(line.fit.phase, line.fit.spacing, offset));
  const [a, b] = normals, determinant = Math.sin(b - a);
  const x = (phases[0] * Math.sin(b) - phases[1] * Math.sin(a)) / determinant;
  const y = (Math.cos(a) * phases[1] - Math.cos(b) * phases[0]) / determinant;
  const { warp: _warp, ...standard } = grid;
  return { ...standard, type: 'isometric', visible: true, isometricAngle: angle,
    cellSize: (lines[0].fit.spacing + lines[1].fit.spacing) / (2 * Math.sin(angle * Math.PI / 180)) * (canvasWidth / width + canvasHeight / height) / 2,
    rotation: calibratedRotation(rotation, 'isometric'),
    origin: { x: (width / 2 + x) * canvasWidth / width, y: (height / 2 + y) * canvasHeight / height } };
}
