import type { GridConfiguration } from './types';
import { calibratedRotation } from './gridRotation';

import { fitProfile, imageContrasts, lineProfile, centralPhase, type ProfileFit } from './gridDetectionProfiles';
import { detectHexGrid } from './hexGridDetection';

/** Contrast projections identify repeated straight square-grid lines without interpreting map content. */
export function detectSquareGrid(pixels: Uint8ClampedArray, width: number, height: number,
  canvasWidth: number, canvasHeight: number, grid: GridConfiguration): GridConfiguration | null {
  const { edges } = imageContrasts(pixels, width, height);
  if (edges.length < 50) return null;
  const offset = Math.ceil(Math.hypot(width, height) / 2);
  let best: { angle: number; x: ProfileFit; y: ProfileFit; score: number } | null = null;
  function inspect(angle: number) {
    const x = lineProfile(edges, offset, angle), y = lineProfile(edges, offset, angle + 90);
    const fitX = fitProfile(x), fitY = fitProfile(y);
    if (!fitX || !fitY || Math.abs(fitX.spacing - fitY.spacing) / fitX.spacing > 0.1) return;
    const score = Math.min(fitX.score, fitY.score);
    if (!best || score > best.score) best = { angle, x: fitX, y: fitY, score };
  }
  for (let angle = 0; angle < 90; angle += 3) inspect(angle);
  const coarse = best as { angle: number; x: ProfileFit; y: ProfileFit; score: number } | null;
  if (!coarse) return null;
  for (let angle = coarse.angle - 2.5; angle <= coarse.angle + 2.5; angle += 0.5) inspect(angle);
  const fit = best as unknown as { angle: number; x: ProfileFit; y: ProfileFit; score: number } | null;
  if (!fit || fit.score < 0.3) return null;
  const scaleX = canvasWidth / width, scaleY = canvasHeight / height;
  const c = Math.cos(fit.angle * Math.PI / 180), s = Math.sin(fit.angle * Math.PI / 180);
  // Keep the representative origin near the image center so angle tolerance cannot amplify a distant offset.
  const x = centralPhase(fit.x.phase, fit.x.spacing, offset), y = centralPhase(fit.y.phase, fit.y.spacing, offset);
  const { warp: _warp, ...standard } = grid;
  return { ...standard, type: 'square', visible: true, cellSize: (fit.x.spacing * scaleX + fit.y.spacing * scaleY) / 2,
    rotation: calibratedRotation(fit.angle, 'square'), origin: { x: (width / 2 + x * c - y * s) * scaleX,
      y: (height / 2 + x * s + y * c) * scaleY } };
}

export function detectGrid(pixels: Uint8ClampedArray, width: number, height: number, canvasWidth: number, canvasHeight: number, grid: GridConfiguration) {
  return grid.type === 'square' ? detectSquareGrid(pixels, width, height, canvasWidth, canvasHeight, grid)
    : detectHexGrid(pixels, width, height, canvasWidth, canvasHeight, grid);
}
