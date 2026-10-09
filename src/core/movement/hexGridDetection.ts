import type { GridConfiguration } from './types';
import { calibratedRotation } from './gridRotation';
import { chooseHexPhase } from './hexDetectionPhase';
import { fitProfile, imageContrasts, lineProfile, type ProfileFit } from './gridDetectionProfiles';

/** Three repeating edge-normal families distinguish a hex lattice; perimeter contrast resolves its center phase. */
export function detectHexGrid(pixels: Uint8ClampedArray, width: number, height: number,
  canvasWidth: number, canvasHeight: number, grid: GridConfiguration): GridConfiguration | null {
  const { gray, edges } = imageContrasts(pixels, width, height);
  if (edges.length < 50) return null;
  const offset = Math.ceil(Math.hypot(width, height) / 2);
  type Fit = { angle: number; profiles: ProfileFit[]; score: number; phase: ReturnType<typeof chooseHexPhase> };
  const best: { value: Fit | null } = { value: null };
  function inspect(angle: number) {
    const profiles = [30, 90, 150].map(normal => fitProfile(lineProfile(edges, offset, angle + normal)));
    if (profiles.some(fit => !fit)) return;
    const fits = profiles as ProfileFit[], sizes = fits.map(fit => fit.spacing);
    if (Math.max(...sizes) / Math.min(...sizes) > 1.1) return;
    const lineScore = Math.min(...fits.map(fit => fit.score));
    if (lineScore < 0.2) return;
    const phase = chooseHexPhase(gray, width, height, angle, fits, offset);
    if (phase.strength < 8) return;
    const score = phase.strength * lineScore;
    if (!best.value || score > best.value.score) best.value = { angle, profiles: fits, score, phase };
  }
  for (let angle = 0; angle < 60; angle += 3) inspect(angle);
  if (!best.value) return null;
  const coarseAngle = best.value.angle;
  for (let angle = coarseAngle - 2.5; angle <= coarseAngle + 2.5; angle += 0.5) inspect(angle);
  const fit = best.value;
  if (!fit) return null;
  const { cell, origin } = fit.phase;
  const { warp: _warp, ...standard } = grid;
  return { ...standard, visible: true, cellSize: cell * (canvasWidth / width + canvasHeight / height) / 2,
    rotation: calibratedRotation(fit.angle - (grid.type === 'hex-pointy' ? 30 : 0), grid.type),
    origin: { x: origin.x * canvasWidth / width, y: origin.y * canvasHeight / height } };
}
