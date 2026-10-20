import { cellIsCovered, coveredArea, type AreaCoverageShape } from '@core/measurement/cellCoverage';
import { circleIntersectionArea, polygonArea } from '@core/measurement/coverageGeometry';
import { createEncounterState } from '@core/encounter/createEncounterState';
import { measureArea } from '@core/measurement/areaGeometry';
import { gridToWorld, worldToGrid } from '@core/movement/gridGeometry';
import { resolveGridGeometry } from '@core/movement/gridScale';

const square = [{ x: -1, y: -1 }, { x: 1, y: -1 }, { x: 1, y: 1 }, { x: -1, y: 1 }];
const center = { x: 0, y: 0 };
const circle: AreaCoverageShape = { shape: 'circle', origin: center, radius: 1, direction: 0, halfAngle: Math.PI / 4, polygon: [] };
const rectangle = (right: number): AreaCoverageShape => ({ ...circle, shape: 'rectangle', polygon: [{ x: -1, y: -1 }, { x: right, y: -1 }, { x: right, y: 1 }, { x: -1, y: 1 }] });

it('counts three square corners and four hex corners, with a separate center fallback', () => {
  const hex = Array.from({ length: 6 }, (_, i) => ({ x: Math.cos(i * Math.PI / 3), y: Math.sin(i * Math.PI / 3) }));
  for (const vertices of [square, hex]) {
    const threshold = vertices.length === 6 ? 4 : 3;
    const corners = new Set(vertices.slice(0, threshold - 1));
    expect(cellIsCovered(vertices, center, p => corners.has(p), 'corners-or-center', circle)).toBe(false);
    expect(cellIsCovered(vertices, center, p => corners.has(p) || p === center, 'corners-or-center', circle)).toBe(true);
    expect(cellIsCovered(vertices, center, p => corners.has(p) || p === center, 'corners-and-origin', circle)).toBe(false);
    corners.add(vertices[threshold - 1]);
    expect(cellIsCovered(vertices, center, p => corners.has(p), 'corners-or-center', circle)).toBe(true);
    expect(cellIsCovered(vertices, center, p => corners.has(p), 'center', circle)).toBe(false);
  }
});
it('requires strictly more than half, distinguishing 49%, exactly 50%, and 51%', () => {
  for (const [right, expected] of [[-0.02, false], [0, false], [0.02, true]] as const) {
    expect(coveredArea(square, rectangle(right))).toBeCloseTo(2 * (right + 1));
    expect(cellIsCovered(square, center, () => true, 'majority', rectangle(right))).toBe(expected);
  }
  expect(coveredArea(square, rectangle(-1))).toBe(0);
});
it('measures circular overlap analytically, including contained circles, quarter circles, and tangencies', () => {
  expect(circleIntersectionArea(square, center, 1)).toBeCloseTo(Math.PI, 10);
  expect(circleIntersectionArea(square, center, 0.5)).toBeCloseTo(Math.PI / 4, 10);
  expect(circleIntersectionArea(square, center, 10)).toBeCloseTo(4, 10);
  expect(circleIntersectionArea(square.map(p => ({ x: p.x + 2, y: p.y })), center, 1)).toBeCloseTo(0, 10);
  const quarter = [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }];
  expect(circleIntersectionArea(quarter, center, 1)).toBeCloseTo(Math.PI / 4, 10);
  expect(circleIntersectionArea([...quarter].reverse(), center, 1)).toBeCloseTo(Math.PI / 4, 10);
});
it('clips a cone by its rays and circular cap rather than counting sampled points', () => {
  expect(coveredArea(square, { ...circle, shape: 'cone' })).toBeCloseTo(Math.PI / 4, 10);
  expect(coveredArea(square, { ...circle, shape: 'cone', halfAngle: Math.PI / 2 })).toBeCloseTo(Math.PI / 2, 10);
});
it.each(['square', 'isometric', 'hex-flat', 'hex-pointy'] as const)('applies center/majority coverage in unprojected %s cells', type => {
  const state = createEncounterState({ id: 'coverage', name: 'Coverage' });
  state.movementRules.snapToGrid = true;
  state.grid = { ...state.grid, type, rotation: 17, origin: { x: 400, y: 300 } };
  const grid = resolveGridGeometry(state.grid), origin = gridToWorld(grid, { x: 32, y: 32 });
  const end = gridToWorld(grid, { x: 160, y: 32 });
  const cells = measureArea(state, origin, end, { shape: 'circle' }, 'one', true, 'majority').cells;
  expect(cells.length).toBeGreaterThan(0);
  for (const cell of cells) {
    const local = cell.map(p => worldToGrid(grid, p));
    expect(polygonArea(local)).toBeGreaterThan(0);
  }
  state.movementRules.snapToGrid = false;
  expect(measureArea(state, origin, end, { shape: 'circle' }, 'one', true, 'majority').cells).toEqual([]);
});
it('distinguishes a captured center from a captured majority without changing the shape', () => {
  const state = createEncounterState({ id: 'coverage', name: 'Coverage' }); state.movementRules.snapToGrid = true;
  const start = { x: 160, y: 160 }, end = { x: 320, y: 160 };
  const centerResult = measureArea(state, start, end, { shape: 'cone', angle: 10 }, 'one', true, 'center');
  const majority = measureArea(state, start, end, { shape: 'cone', angle: 10 }, 'one', true, 'majority');
  expect(centerResult.outlines).toEqual(majority.outlines);
  expect(centerResult.cells.length).toBeGreaterThan(majority.cells.length);
  expect(centerResult.area).toBeGreaterThan(majority.area);
});

it.each(['hex-flat', 'hex-pointy'] as const)('offers one or all forward origin neighbors on %s, excluding the source', type => {
  const state = createEncounterState({ id: 'cone', name: 'Cone' }); state.movementRules.snapToGrid = true;
  state.grid = { ...state.grid, type, origin: { x: 400, y: 300 } };
  const grid = resolveGridGeometry(state.grid), source = gridToWorld(grid, { x: 0, y: 0 });
  const target = gridToWorld(grid, { x: 192, y: 0 }), options = { shape: 'cone' as const, angle: 10 };
  const first = measureArea(state, source, target, options, 'one', false, 'corners-and-origin');
  const all = measureArea(state, source, target, options, 'one', false, 'corners-and-adjacent');
  expect(first.cells).toHaveLength(1); expect(all.cells).toHaveLength(2);
  expect(all.cells).toContainEqual(first.cells[0]);
  for (const cell of all.cells) {
    const local = cell.map(p => worldToGrid(grid, p));
    expect(local.reduce((sum, p) => sum + p.x, 0) / local.length).toBeGreaterThan(0);
  }
  expect(first.outlines).toEqual(all.outlines);
});
it('includes only the first forward square for the narrow-cone origin exception', () => {
  const state = createEncounterState({ id: 'cone', name: 'Cone' }); state.movementRules.snapToGrid = true;
  const result = measureArea(state, { x: 160, y: 160 }, { x: 384, y: 160 }, { shape: 'cone', angle: 10 }, 'one', false, 'corners-and-origin');
  expect(result.cells).toHaveLength(1);
  expect(result.cells[0]).toContainEqual({ x: 192, y: 128 });
  expect(result.cells[0]).not.toContainEqual({ x: 128, y: 128 });
});
