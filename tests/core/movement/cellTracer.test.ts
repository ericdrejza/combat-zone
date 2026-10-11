import { createEncounterState } from '@core/encounter/createEncounterState';
import { createZone } from '@entities/zone/zoneMutations';
import { buildCellGraph, traceCellRoute, compressCellRoute, validTracedPolygon } from '@core/movement/cellTracer';
import { cellVertices } from '@core/movement/gridTopology';
import { resolveGridGeometry } from '@core/movement/gridScale';
import { gridToWorld } from '@core/movement/gridGeometry';
function fixture() { const state = createEncounterState({ id: 'trace', name: 'Trace' }); state.canvasSize = { width: 384, height: 384 }; return state; }
describe('Cell Tracer grid-edge routes', () => {
  it('minimizes edges then turns and uses stable tie order', () => {
    const state = fixture(), start = { x: 64, y: 64 }, end = { x: 192, y: 192 };
    const route = traceCellRoute(state, start, end, [start]);
    expect(route).toEqual([start, { x: 192, y: 64 }, end]);
    expect(traceCellRoute(state, start, end, [start])).toEqual(route);
  });
  it('materializes only turns without losing selected endpoints', () => {
    expect(compressCellRoute([{ x: 0, y: 0 }, { x: 64, y: 0 }, { x: 128, y: 0 }, { x: 128, y: 64 }])).toEqual([{ x: 0, y: 0 }, { x: 128, y: 0 }, { x: 128, y: 64 }]);
  });
  it.each(['hex-flat', 'hex-pointy'] as const)('traces actual neighboring %s vertices', type => {
    const state = fixture(); state.grid.type = type;
    const vertices = cellVertices(resolveGridGeometry(state.grid), { x: 192, y: 192 });
    // Use a real center from the physical lattice, not an arbitrary screen point.
    const grid = resolveGridGeometry(state.grid), center = gridToWorld(grid, { x: 64 * Math.sqrt(3), y: 192 });
    const cell = cellVertices(grid, center);
    expect(traceCellRoute(state, cell[0], cell[1], [cell[0]])).toEqual([cell[0], cell[1]]);
    expect(vertices).toHaveLength(6);
  });
  it('uses the rotated lattice and rejects off-graph endpoints', () => {
    const state = fixture(); state.grid.rotation = 45; state.grid.origin = { x: 192, y: 64 };
    const grid = resolveGridGeometry(state.grid), start = gridToWorld(grid, { x: 0, y: 0 }), end = gridToWorld(grid, { x: 128, y: 0 });
    expect(traceCellRoute(state, start, end, [start])).toEqual([start, end]);
    expect(traceCellRoute(state, start, { x: -100, y: -100 }, [start])).toBeNull();
  });
  it('traces closure and rejects self-intersection and degenerate polygons', () => {
    const state = fixture(), points = [{ x: 64, y: 64 }, { x: 192, y: 64 }, { x: 192, y: 192 }];
    const closing = traceCellRoute(state, points[2], points[0], points, 'reject', true);
    expect(closing).toEqual([points[2], { x: 64, y: 192 }, points[0]]);
    expect(validTracedPolygon(state, [...points, { x: 64, y: 192 }])).toBe(true);
    expect(validTracedPolygon(state, [{ x: 64, y: 64 }, { x: 192, y: 192 }, { x: 64, y: 192 }, { x: 192, y: 64 }])).toBe(false);
  });
  it('can detour around an occupied Zone while preserving the original draft', () => {
    const state = createZone(fixture(), { id: 'obstacle', polygon: [{ x: 128, y: 0 }, { x: 192, y: 0 }, { x: 192, y: 128 }, { x: 128, y: 128 }] });
    const start = { x: 64, y: 64 }, end = { x: 256, y: 64 }, draft = [start];
    expect(traceCellRoute(state, start, end, draft, 'reject')).toBeNull();
    expect(traceCellRoute(state, start, end, draft, 'detour')).not.toBeNull();
    expect(draft).toEqual([start]);
  });
  it('disallows warp and excludes out-of-canvas graph edges', () => {
    const state = fixture(), graph = buildCellGraph(state);
    expect([...graph.points.values()].every(point => point.x >= 0 && point.y >= 0 && point.x <= 384 && point.y <= 384)).toBe(true);
    state.grid.warp = { type: 'bilinear', x: [0, 1, 0, 0], y: [0, 0, 1, 0] };
    expect(traceCellRoute(state, { x: 64, y: 64 }, { x: 128, y: 64 })).toBeNull();
  });
});
