import { coneGeometry } from '@core/measurement/coneGeometry';
import { createEncounterState } from '@core/encounter/createEncounterState';
import { measureArea, snapRulerOrigin, rulerSnapEnabled } from '@core/measurement/areaGeometry';
import { DEFAULT_RULER_OPTIONS } from '@core/measurement/types';
import { gridToWorld } from '@core/movement/gridGeometry';
import { resolveGridGeometry } from '@core/movement/gridScale';

const base = () => { const state = createEncounterState({ id: 'map', name: 'Map' }); state.movementRules.snapToGrid = true; return state; };
describe('ruler areas', () => {
  it('follows actor snapping even with zone locking', () => {
    const state = base(); state.movementRules.snapToGrid = true;
    expect(rulerSnapEnabled(state, DEFAULT_RULER_OPTIONS)).toBe(true);
    state.movementRules.zoneLocked = false;
    expect(rulerSnapEnabled(state, DEFAULT_RULER_OPTIONS)).toBe(true);
    state.movementRules.snapToGrid = false;
    expect(rulerSnapEnabled(state, DEFAULT_RULER_OPTIONS)).toBe(false);
  });
  it('highlights circle cells with three covered corners, and reports their combined area', () => {
    const state = base(), options = { ...DEFAULT_RULER_OPTIONS, shape: 'circle' as const };
    const result = measureArea(state, { x: 128, y: 128 }, { x: 192, y: 128 }, options);
    expect(result.cells).toHaveLength(4);
    state.movementRules.snapToGrid = false;
    const larger = measureArea(state, { x: 128, y: 128 }, { x: 224, y: 128 }, options);
    expect(larger.cells).toHaveLength(0); expect(larger.area).toBeCloseTo(56.25 * Math.PI);
    expect(measureArea(state, { x: 128, y: 128 }, { x: 192, y: 128 }, options).area).toBeCloseTo(25 * Math.PI);
  });
  it.each(['square', 'isometric', 'hex-flat', 'hex-pointy'] as const)('measures rectangle area on %s geometry', type => {
    const state = base(); state.movementRules.snapToGrid = false; state.grid.type = type; state.grid.origin = { x: 256, y: 100 }; state.grid.rotation = 15;
    const geometry = resolveGridGeometry(state.grid), a = gridToWorld(geometry, { x: 0, y: 0 }), b = gridToWorld(geometry, { x: 128, y: 64 });
    expect(measureArea(state, a, b, { ...DEFAULT_RULER_OPTIONS, shape: 'rectangle' }).area).toBeCloseTo(50);
  });
  it('chooses the clicked cell boundary origin from the target direction', () => {
    const state = base(), source = { x: 32, y: 32 };
    expect(coneGeometry(state, source, { x: 224, y: 32 })).toEqual({ origin: { x: 64, y: 32 }, direction: 0 });
    const corner = coneGeometry(state, source, { x: 224, y: 224 });
    expect(corner.origin.x).toBeCloseTo(64); expect(corner.origin.y).toBeCloseTo(64);
    expect(coneGeometry(state, source, { x: -224, y: 32 }).origin.x).toBeCloseTo(0);
    expect(snapRulerOrigin(state, { x: 62, y: 29 }, { ...DEFAULT_RULER_OPTIONS, shape: 'cone' })).toEqual(source);
  });
  it('defaults hex cones to sixty degrees', () => {
    const state = base(); state.movementRules.snapToGrid = false; state.grid.type = 'hex-flat';
    const result = measureArea(state, { x: 200, y: 200 }, { x: 264, y: 200 }, { ...DEFAULT_RULER_OPTIONS, shape: 'cone' });
    expect(result.area).toBeCloseTo(25 * Math.PI / 6);
  });
  it('chooses a consistent line to the target without fixed pattern options', () => {
    const state = base(), options = { ...DEFAULT_RULER_OPTIONS, shape: 'line' as const };
    const result = measureArea(state, { x: 160, y: 160 }, { x: 416, y: 288 }, options);
    expect(result.cells).toHaveLength(5);
    expect(result.area).toBe(125);
    state.movementRules.snapToGrid = false;
    expect(measureArea(state, { x: 160, y: 160 }, { x: 416, y: 288 }, options).cells).toEqual([]);
  });
  it.each(['hex-flat', 'hex-pointy'] as const)('builds a shortest line on %s', type => {
    const state = base(); state.grid.type = type; state.grid.origin = { x: 300, y: 200 };
    const grid = resolveGridGeometry(state.grid), start = gridToWorld(grid, { x: 0, y: 0 }), end = gridToWorld(grid, { x: 200, y: 100 });
    const result = measureArea(state, start, end, { ...DEFAULT_RULER_OPTIONS, shape: 'line' });
    expect(result.cells.length).toBeGreaterThan(1);
    expect(result.area).toBeCloseTo(result.cells.length * Math.sqrt(3) / 2 * 25);
  });
});

it('includes three covered corners or the cell center, excluding cells with neither', () => {
  const state = base();
  const result = measureArea(state, { x: 128, y: 128 }, { x: 320, y: 128 }, { ...DEFAULT_RULER_OPTIONS, shape: 'circle' });
  const centers = result.cells.map(vertices => ({ x: vertices.reduce((sum, p) => sum + p.x, 0) / 4, y: vertices.reduce((sum, p) => sum + p.y, 0) / 4 }));
  expect(centers).toContainEqual({ x: 288, y: 160 });
  expect(centers).toContainEqual({ x: 288, y: 224 });
  expect(centers).not.toContainEqual({ x: 288, y: 288 });
});
it('can skip calculated area while retaining the same highlighted cells', () => {
  const state = base(), options = { ...DEFAULT_RULER_OPTIONS, shape: 'circle' as const };
  const full = measureArea(state, { x: 128, y: 128 }, { x: 320, y: 128 }, options);
  const preview = measureArea(state, { x: 128, y: 128 }, { x: 320, y: 128 }, options, 'one', false);
  expect(preview.cells).toEqual(full.cells); expect(preview.area).toBe(0); expect(full.area).toBeGreaterThan(0);
});

it.each(['square', 'isometric', 'hex-flat', 'hex-pointy'] as const)('keeps snapped cone boundary origins outward under %s projection', type => {
  const state = base(); state.grid.type = type; state.grid.origin = { x: 400, y: 300 }; state.grid.rotation = 25;
  const grid = resolveGridGeometry(state.grid), clicked = gridToWorld(grid, { x: 32, y: 32 });
  const center = snapRulerOrigin(state, clicked, { ...DEFAULT_RULER_OPTIONS, shape: 'cone' });
  const east = gridToWorld(grid, { x: 300, y: 32 });
  const result = coneGeometry(state, center, east);
  // An eastward trajectory can never originate on the cell's inward-facing west boundary.
  const dx = result.origin.x - center.x, dy = result.origin.y - center.y;
  expect(dx * (east.x - center.x) + dy * (east.y - center.y)).toBeGreaterThan(0);
});
