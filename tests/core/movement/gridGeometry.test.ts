import { createDefaultGrid } from '@core/movement/types';
import { calibrateGrid } from '@core/movement/gridCalibration';
import { gridToWorld, snapToGrid, spatialActorRadius, gridKeyboardStep, footprintFits } from '@core/movement/gridGeometry';
import { buildActor } from '@entities/actor/actorMutations';

describe('grid geometry', () => {
  const square = createDefaultGrid();
  it('uses cell centers except Large square intersections', () => {
    for (const size of ['small', 'medium', 'xLarge'] as const) expect(snapToGrid(square, { x: 80, y: 75 }, size)).toEqual({ x: 96, y: 96 });
    expect(snapToGrid(square, { x: 80, y: 75 }, 'large')).toEqual({ x: 64, y: 64 });
    expect(spatialActorRadius(buildActor({ id: 'a', currentZoneId: 'zoneless' }), square)).toBeCloseTo(28.8);
  });
  it('respects rotated and translated square anchors', () => {
    const grid = { ...square, rotation: 37, origin: { x: -24, y: 17 } };
    const target = gridToWorld(grid, { x: 96, y: 160 });
    const result = snapToGrid(grid, { x: target.x + 2, y: target.y - 1 }, 'medium');
    expect(result.x).toBeCloseTo(target.x); expect(result.y).toBeCloseTo(target.y);
  });
  it.each(['hex-pointy', 'hex-flat'] as const)('snaps centers and three-cell vertices for %s', type => {
    const grid = { ...square, type, origin: { x: 200, y: 200 }, rotation: 17 };
    expect(snapToGrid(grid, { x: 202, y: 200 }, 'medium')).toEqual(grid.origin);
    const vertex = gridToWorld(grid, { x: 64 / Math.sqrt(3), y: 0 });
    const snapped = snapToGrid(grid, vertex, 'large');
    expect(snapped.x).toBeCloseTo(vertex.x); expect(snapped.y).toBeCloseTo(vertex.y);
    const step = gridKeyboardStep(grid, grid.origin, 'medium', { x: 1, y: 0 });
    expect(Math.hypot(step.x - 200, step.y - 200)).toBeCloseTo(64);
    expect(step.x).toBeGreaterThan(200);
  });
  it('fits square calibration in either click direction and rejects degenerate points', () => {
    for (const sign of [-1, 1]) {
      const fit = calibrateGrid(square, [{ x: 100, y: 100 }, { x: 150, y: 100 }, { x: 150, y: 100 + sign * 50 }, { x: 100, y: 100 + sign * 50 }]);
      expect(fit).toMatchObject({ cellSize: 50, origin: { x: 100, y: 100 }, rotation: 0 });
    }
    expect(calibrateGrid(square, [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }])).toBeNull();
  });
  it.each(['hex-pointy', 'hex-flat'] as const)('calibrates %s from consecutive vertices in either direction', type => {
    const grid = { ...square, type, rotation: 19, origin: { x: 70, y: 80 } };
    for (const sign of [-1, 1]) {
      const points = [0, 1, 2].map(k => gridToWorld(grid, { x: 64 / Math.sqrt(3) * Math.cos(k * sign * Math.PI / 3), y: 64 / Math.sqrt(3) * Math.sin(k * sign * Math.PI / 3) }));
      const fit = calibrateGrid(grid, points);
      expect(fit!.cellSize).toBeCloseTo(64); expect(fit!.rotation).toBeCloseTo(19);
      expect(fit!.origin.x).toBeCloseTo(70); expect(fit!.origin.y).toBeCloseTo(80);
    }
  });
  it('rejects a full footprint outside the canvas', () => {
    expect(footprintFits({ x: 5, y: 20 }, 10, { width: 100, height: 100 })).toBe(false);
  });
});
