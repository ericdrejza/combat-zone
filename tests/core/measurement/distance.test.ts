import { createDefaultGrid } from '@core/movement/types';
import { gridToWorld } from '@core/movement/gridGeometry';
import { resolveGridGeometry } from '@core/movement/gridScale';
import { measureRoute } from '@core/measurement/distance';
import { gridEdgeSegments } from '@core/measurement/gridLineStyle';

describe('measurement distances', () => {
  it.each(['square', 'isometric', 'hex-flat', 'hex-pointy'] as const)('measures geometric distance before %s projection and rotation', type => {
    const grid = { ...createDefaultGrid(), type, rotation: 33, origin: { x: 123, y: 175 }, distancePerCell: 10 };
    const geometry = resolveGridGeometry(grid);
    const points = [{ x: 64, y: 64 }, { x: 256, y: 320 }].map(p => gridToWorld(geometry, p));
    expect(measureRoute(grid, points, false).distance).toBeCloseTo(50);
  });
  it('uses inverse warp, independent of user-facing map size', () => {
    const grid = { ...createDefaultGrid(), cellSize: 13, warp: { type: 'bilinear' as const, x: [0, 1, 0.1, 0.01] as [number, number, number, number], y: [0, 0.1, 1, 0.01] as [number, number, number, number] } };
    const geometry = resolveGridGeometry(grid);
    expect(measureRoute(grid, [{ x: 32, y: 32 }, { x: 224, y: 288 }].map(p => gridToWorld(geometry, p)), false).distance).toBeCloseTo(25);
  });
  it.each([['one', 15], ['alternating', 20], ['two', 30], ['disabled', 30]] as const)('prices square diagonals with %s', (policy, expected) => {
    const route = measureRoute(createDefaultGrid(), [{ x: 32, y: 32 }, { x: 224, y: 224 }], true, policy);
    expect(route.distance).toBe(expected);
    if (policy === 'disabled') expect(route.points.slice(1).every((p, i) => p.x === route.points[i].x || p.y === route.points[i].y)).toBe(true);
  });
  it('retains alternating parity through waypoints and prior steps', () => {
    const grid = createDefaultGrid(), points = [{ x: 32, y: 32 }, { x: 96, y: 96 }, { x: 160, y: 160 }];
    expect(measureRoute(grid, points, true, 'alternating').distance).toBe(15);
    expect(measureRoute(grid, points.slice(0, 2), true, 'alternating', 1).distance).toBe(10);
  });
  it.each(['small', 'medium', 'large', 'xLarge'] as const)('steps hex %s anchors to their actual endpoint', size => {
    const grid = { ...createDefaultGrid(), type: 'hex-flat' as const };
    const geometry = resolveGridGeometry(grid);
    const start = gridToWorld(geometry, { x: size === 'large' ? 64 / Math.sqrt(3) : 0, y: 0 });
    const end = gridToWorld(geometry, { x: (size === 'large' ? 64 / Math.sqrt(3) : 0) + 64 * Math.sqrt(3), y: 0 });
    const route = measureRoute(grid, [start, end], true, 'disabled', 0, size);
    expect(route.points[route.points.length - 1]?.x).toBeCloseTo(end.x);
    expect(route.points[route.points.length - 1]?.y).toBeCloseTo(end.y);
    expect(route.distance).toBeGreaterThan(0);
  });
  it('splits crosshair edges at quarter points without changing their vertices', () => {
    expect(gridEdgeSegments({ x: 0, y: 0 }, { x: 64, y: 0 }, 'crosshair')).toEqual([
      [{ x: 0, y: 0 }, { x: 16, y: 0 }], [{ x: 48, y: 0 }, { x: 64, y: 0 }]
    ]);
  });
});
