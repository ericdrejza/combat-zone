import { createEncounterState } from '@core/encounter/createEncounterState';
import { createDefaultGrid } from '@core/movement/types';
import { gridToWorld, worldToGrid, gridKeyboardStep, snapToGrid, spatialActorRadius } from '@core/movement/gridGeometry';
import { actorAnchorCells, cellVertices, nearestGridVertex } from '@core/movement/gridTopology';
import { resolveGridGeometry } from '@core/movement/gridScale';
import { normalizeGridRotation } from '@core/movement/gridRotation';
import { translateSnappedZone } from '@core/movement/zoneVertexSnapping';
import { warpFitsCanvas } from '@core/movement/gridWarp';
import { completedBoundaryCells, getGridEdgePadding } from '@core/movement/gridEdgeCompletion';
import { buildCellGraph, traceCellRoute } from '@core/movement/cellTracer';

const state = () => {
  const value = createEncounterState({ id: 'iso', name: 'Iso' });
  value.grid = { ...value.grid, type: 'isometric', origin: { x: 256, y: 128 } };
  return value;
};

it('renders a 64×32 diamond and retains fixed token and map-scale sizes', () => {
  const encounter = state(), grid = resolveGridGeometry(encounter.grid);
  const center = gridToWorld(grid, { x: 32, y: 32 });
  const vertices = cellVertices(grid, center);
  expect(vertices).toEqual([{ x: 256, y: 128 }, { x: 288, y: 144 }, { x: 256, y: 160 }, { x: 224, y: 144 }]);
  expect(Math.max(...vertices.map(p => p.x)) - Math.min(...vertices.map(p => p.x))).toBe(64);
  expect(Math.max(...vertices.map(p => p.y)) - Math.min(...vertices.map(p => p.y))).toBe(32);
  expect(resolveGridGeometry({ ...encounter.grid, cellSize: 32 }).cellSize).toBe(64);
  expect(spatialActorRadius({ size: 'medium' }, encounter.grid)).toBe(30);
  expect(normalizeGridRotation(90, 'isometric')).toBe(90);
  expect(normalizeGridRotation(180, 'isometric')).toBe(0);
});

it.each([0, 31, 90])('inverts rotated and warped projection at %s°', rotation => {
  const grid = { ...resolveGridGeometry(state().grid), rotation,
    warp: { type: 'bilinear' as const, x: [0, 1, 0, 0.002] as [number, number, number, number], y: [0, 0, 1, 0.001] as [number, number, number, number] } };
  const local = { x: 272, y: -120 };
  const restored = worldToGrid(grid, gridToWorld(grid, local));
  expect(restored.x).toBeCloseTo(local.x, 6);
  expect(restored.y).toBeCloseTo(local.y, 6);
  expect(warpFitsCanvas(grid, { width: 960, height: 640 })).toBe(true);
  expect(warpFitsCanvas({ ...grid, warp: { ...grid.warp, x: [0, -1, 0, 0] } }, { width: 960, height: 640 })).toBe(false);
});

it.each(['small', 'medium', 'large', 'xLarge'] as const)('reserves square neighborhoods for %s', size => {
  const encounter = state(), grid = resolveGridGeometry(encounter.grid);
  const point = snapToGrid(grid, { x: 277, y: 237 }, size);
  const cells = actorAnchorCells(encounter, point, size);
  expect(cells).toHaveLength(size === 'large' ? 4 : size === 'xLarge' ? 9 : 1);
  if (size === 'large') expect(nearestGridVertex(encounter, point)).toEqual(point);
});

it('reaches each of the four edge neighbors through screen arrow keys', () => {
  const grid = { ...createDefaultGrid(), type: 'isometric' as const };
  const point = gridToWorld(grid, { x: 32, y: 32 });
  const next = [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }]
    .map(direction => gridKeyboardStep(grid, point, 'medium', direction));
  expect(next).toEqual([{ x: 32, y: 32 }, { x: -32, y: 32 }, { x: -32, y: 0 }, { x: 32, y: 0 }]);
});

it('moves snapped Zones rigidly on the diamond lattice', () => {
  const encounter = state(); encounter.movementRules.snapZoneVertices = true;
  const grid = resolveGridGeometry(encounter.grid);
  const polygon = [{ x: 0, y: 0 }, { x: 128, y: 0 }, { x: 128, y: 128 }, { x: 0, y: 128 }].map(p => gridToWorld(grid, p));
  const moved = translateSnappedZone(encounter, { shape: 'polygon', polygon }, { x: 30, y: 15 });
  expect(moved).toEqual(polygon.map(p => ({ x: p.x + 32, y: p.y + 16 })));
  moved.forEach(p => expect(nearestGridVertex(encounter, p)).toEqual(p));
});

it('completes boundary diamonds without dropping intersecting cells', () => {
  const grid = resolveGridGeometry(state().grid), canvas = { width: 300, height: 180 };
  const padding = getGridEdgePadding(grid, canvas);
  const cells = completedBoundaryCells(grid, { ...canvas, x: 0, y: 0 });
  expect(cells.length).toBeGreaterThan(0);
  cells.flat().forEach(p => {
    expect(p.x).toBeGreaterThanOrEqual(-padding.left - 1e-6);
    expect(p.y).toBeGreaterThanOrEqual(-padding.top - 1e-6);
    expect(p.x).toBeLessThanOrEqual(canvas.width + padding.right + 1e-6);
    expect(p.y).toBeLessThanOrEqual(canvas.height + padding.bottom + 1e-6);
  });
});

it('traces the shortest diamond-edge route and keeps only turns', () => {
  const encounter = state(), grid = resolveGridGeometry(encounter.grid);
  const start = gridToWorld(grid, { x: 0, y: 0 });
  const end = gridToWorld(grid, { x: 128, y: 128 });
  const route = traceCellRoute(encounter, start, end, [start], 'reject', false, buildCellGraph(encounter));
  expect(route).not.toBeNull();
  expect(route![0]).toEqual(start); expect(route!.at(-1)).toEqual(end);
  expect(route).toHaveLength(3);
  const logical = route!.map(p => worldToGrid(grid, p));
  let length = 0;
  for (let i = 1; i < logical.length; i++) {
    const dx = Math.abs(logical[i].x - logical[i - 1].x), dy = Math.abs(logical[i].y - logical[i - 1].y);
    expect(dx === 0 || dy === 0).toBe(true); length += dx + dy;
  }
  expect(length).toBe(256);
});

it.each([1, 15, 30, 45])('uses configurable %s° diamonds with an exact inverse', isometricAngle => {
  const grid = { ...resolveGridGeometry(state().grid), isometricAngle };
  const point = { x: 272, y: -120 };
  const restored = worldToGrid(grid, gridToWorld(grid, point));
  expect(restored.x).toBeCloseTo(point.x, 6); expect(restored.y).toBeCloseTo(point.y, 6);
  const vertices = cellVertices(grid, gridToWorld(grid, { x: 32, y: 32 }));
  expect(Math.max(...vertices.map(p => p.x)) - Math.min(...vertices.map(p => p.x))).toBeCloseTo(64);
  expect(Math.max(...vertices.map(p => p.y)) - Math.min(...vertices.map(p => p.y))).toBeCloseTo(64 * Math.tan(isometricAngle * Math.PI / 180));
});
