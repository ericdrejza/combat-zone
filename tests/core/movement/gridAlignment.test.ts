import { createDefaultGrid } from '@core/movement/types';
import { calibrateGrid, calibrateQuadrants } from '@core/movement/gridCalibration';
import { gridToWorld, worldToGrid, snapToGrid, gridKeyboardStep, spatialActorRadius } from '@core/movement/gridGeometry';
import { normalizeGridRotation, calibratedRotation, stepWholeNumber } from '@core/movement/gridRotation';
import { warpFitsCanvas } from '@core/movement/gridWarp';
import type { GridConfiguration } from '@core/movement/types';

const base = { ...createDefaultGrid(), cellSize: 50, origin: { x: 100, y: 100 } };
describe('grid alignment strategies', () => {
  it.each([0, 45, 90, 135, -45, 360])('snaps within five degrees of %s and wraps square symmetry', angle => {
    for (const delta of [-5, -3, 0, 4, 5]) expect(calibratedRotation(angle + delta, 'square')).toBe(normalizeGridRotation(angle, 'square'));
    expect(calibratedRotation(angle + 6, 'square')).toBe(normalizeGridRotation(angle + 6, 'square'));
  });
  it('keeps hex symmetry at 60 degrees and steps fractional fields to integers', () => {
    expect(normalizeGridRotation(60, 'hex-flat')).toBe(0);
    expect(normalizeGridRotation(90, 'hex-pointy')).toBe(30);
    expect(stepWholeNumber(2.3, 1)).toBe(3); expect(stepWholeNumber(2.3, -1)).toBe(2);
    expect(stepWholeNumber(-2.3, 1)).toBe(-2); expect(stepWholeNumber(-2.3, -1)).toBe(-3);
  });
  it('snaps a noisy auto-align calculation to 45 degrees', () => {
    const grid = { ...base, rotation: 43 };
    const fit = calibrateGrid(grid, [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 50 }, { x: 0, y: 50 }].map(p => gridToWorld(grid, p)));
    expect(fit!.rotation).toBe(45);
  });
  it('fits four quadrants and offers a warp for distorted samples', () => {
    const distorted: GridConfiguration = { ...base, warp: { type: 'bilinear', x: [0, 1, 0, 0.006], y: [0, 0, 1, 0.004] } };
    const points = [[0, 0], [12, 0], [12, 8], [0, 8]].flatMap(([x, y]) => [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]].map(([q, r]) => gridToWorld(distorted, { x: q * 50, y: r * 50 })));
    const fit = calibrateQuadrants(base, points, { width: 960, height: 640 });
    expect(fit).not.toBeNull(); expect(fit!.warped).not.toBeNull(); expect(fit!.distortion).toBeGreaterThan(1);
    for (const point of points) {
      const snapped = snapToGrid(fit!.warped!, point, 'large');
      expect(Math.hypot(snapped.x - point.x, snapped.y - point.y)).toBeLessThan(0.01);
    }
  });
  it('inverts warped cells and keeps keyboard steps on adjacent lattice anchors', () => {
    const grid: GridConfiguration = { ...base, warp: { type: 'bilinear', x: [0, 1, 0, 0.01], y: [0, 0, 1, 0.005] } };
    const local = { x: 225, y: 125 }, point = gridToWorld(grid, local), restored = worldToGrid(grid, point);
    expect(restored.x).toBeCloseTo(local.x); expect(restored.y).toBeCloseTo(local.y);
    const step = worldToGrid(grid, gridKeyboardStep(grid, point, 'medium', { x: 1, y: 0 }));
    expect(step.x).toBeCloseTo(275); expect(step.y).toBeCloseTo(125);
    expect(spatialActorRadius({ size: 'medium' }, grid, point)).toBeGreaterThan(0);
    expect(warpFitsCanvas(grid, { width: 960, height: 640 })).toBe(true);
  });
  it.each(['hex-pointy', 'hex-flat'] as const)('fits twelve vertices across four quadrants for %s', type => {
    const grid = { ...base, type };
    const distorted: GridConfiguration = { ...grid, warp: { type: 'bilinear', x: [0, 1, 0, 0.004], y: [0, 0, 1, 0.003] } };
    const radius = grid.cellSize / Math.sqrt(3);
    const points = [[0, 0], [10, -5], [10, 2], [0, 7]].flatMap(([q, r]) => [0, 1, 2].map(k => gridToWorld(distorted,
      { x: q * 1.5 * radius + radius * Math.cos(k * Math.PI / 3), y: (r + q / 2) * grid.cellSize + radius * Math.sin(k * Math.PI / 3) })));
    const fit = calibrateQuadrants(grid, points, { width: 960, height: 640 });
    expect(fit?.warped).toBeTruthy();
    for (const point of points) {
      const snapped = snapToGrid(fit!.warped!, point, 'large');
      expect(Math.hypot(snapped.x - point.x, snapped.y - point.y)).toBeLessThan(0.02);
    }
  });
  it('rejects folded or singular warps', () => {
    expect(warpFitsCanvas({ ...base, warp: { type: 'bilinear', x: [0, -1, 0, 0], y: [0, 0, 1, 0] } }, { width: 960, height: 640 })).toBe(false);
    expect(warpFitsCanvas({ ...base, warp: { type: 'bilinear', x: [0, 0, 0, 0], y: [0, 0, 0, 0] } }, { width: 960, height: 640 })).toBe(false);
  });
});
