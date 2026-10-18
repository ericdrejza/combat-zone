import { createEncounterState } from '@core/encounter/createEncounterState';
import { DEFAULT_EDGE_PRESET } from '@entities/edge/edgeMutations';
import type { Edge } from '@entities/edge/types';
import type { CalculatedEdgeRoute, EdgeRouteInput } from '@ui/canvas/edges/edgeRouteCalculation';
import { EdgeRouteSession } from '@ui/canvas/edges/edgeRouteSession';
import { temporaryEdgeRoute } from '@ui/canvas/edges/temporaryEdgeRoute';
import * as repair from '@ui/canvas/edges/repairEdgeRoute';

const rect = (x: number, y: number) => [{ x, y }, { x: x + 100, y }, { x: x + 100, y: y + 100 }, { x, y: y + 100 }];
const translate = (polygon: ReturnType<typeof rect>, x: number, y: number) => polygon.map(p => ({ x: p.x + x, y: p.y + y }));

function fixture() {
  const state = createEncounterState({ id: 'anchor-preview', name: 'Anchor preview' });
  const edge: Edge = { ...DEFAULT_EDGE_PRESET, id: 'edge', fromZoneId: 'source', toZoneId: 'target', interactionTags: [] };
  const input: EdgeRouteInput = { encounterId: state.id, state, edges: [edge], polygons: { source: rect(100, 100), target: rect(400, 100) } };
  const path = [{ x: 200, y: 150 }, { x: 400, y: 150 }];
  const route: CalculatedEdgeRoute = { fromZoneId: 'source', toZoneId: 'target', fromPolygon: input.polygons.source, toPolygon: input.polygons.target,
    path, data: 'M 200 150 L 400 150', automatic: false, badgeFraction: 0.5, route: { path, valid: true, clearance: 12 } };
  const session = new EdgeRouteSession();
  session.prepare(input); session.store(edge, route, input, false);
  return { input, edge, route, session };
}

describe('Edge preview anchor displacement', () => {
  afterEach(() => vi.restoreAllMocks());

  it('does not apply the worker fallback displacement again on the UI', () => {
    vi.spyOn(repair, 'repairEdgeRoute').mockReturnValue(undefined);
    const { input, edge, session } = fixture();
    const moved = translate(input.polygons.source, 40, 20);
    const live: EdgeRouteInput = { ...input, live: true, estimateOnly: true, polygons: { ...input.polygons, source: moved } };
    session.prepare(live);
    const preview = session.reuse(edge, live)!;
    session.store(edge, preview, live, true);
    const displayed = temporaryEdgeRoute(preview, moved, live.polygons.target);
    expect(displayed.path[0]).toEqual({ x: 240, y: 170 });
    expect(displayed.path.at(-1)).toEqual({ x: 400, y: 150 });
  });

  it('adds only the movement since an older worker preview', () => {
    vi.spyOn(repair, 'repairEdgeRoute').mockReturnValue(undefined);
    const { input, edge, session } = fixture();
    const live: EdgeRouteInput = { ...input, live: true, estimateOnly: true, polygons: { ...input.polygons, source: translate(input.polygons.source, 40, 20) } };
    session.prepare(live);
    const preview = session.reuse(edge, live)!;
    const displayed = temporaryEdgeRoute(preview, translate(input.polygons.source, 60, 30), input.polygons.target);
    expect(displayed.path[0]).toEqual({ x: 260, y: 180 });
    expect(displayed.path.at(-1)).toEqual({ x: 400, y: 150 });
  });

  it('tracks the target anchor without shifting the stationary source', () => {
    vi.spyOn(repair, 'repairEdgeRoute').mockReturnValue(undefined);
    const { input, edge, session } = fixture();
    const live: EdgeRouteInput = { ...input, live: true, estimateOnly: true, polygons: { ...input.polygons, target: translate(input.polygons.target, -30, 40) } };
    session.prepare(live);
    const preview = session.reuse(edge, live)!;
    const displayed = temporaryEdgeRoute(preview, live.polygons.source, live.polygons.target);
    expect(displayed.path[0]).toEqual({ x: 200, y: 150 });
    expect(displayed.path.at(-1)).toEqual({ x: 370, y: 190 });
  });

  it('keeps a side anchor fixed when resizing leaves it on the same border', () => {
    vi.spyOn(repair, 'repairEdgeRoute').mockReturnValue(undefined);
    const { input, edge, session } = fixture();
    const source = input.polygons.source.map(point => ({ x: point.x, y: point.y === 200 ? 300 : point.y }));
    const live: EdgeRouteInput = { ...input, live: true, estimateOnly: true, polygons: { ...input.polygons, source } };
    session.prepare(live);
    const preview = session.reuse(edge, live)!;
    expect(temporaryEdgeRoute(preview, source, live.polygons.target).path[0]).toEqual({ x: 200, y: 150 });
  });

  it('does not accumulate displacement over repeated fallback frames', () => {
    vi.spyOn(repair, 'repairEdgeRoute').mockReturnValue(undefined);
    const { input, edge, session } = fixture();
    for (const amount of [10, 20, 40, 20, 0]) {
      const live: EdgeRouteInput = { ...input, live: true, estimateOnly: true, polygons: { ...input.polygons, source: translate(input.polygons.source, amount, amount) } };
      session.prepare(live);
      const preview = session.reuse(edge, live)!;
      session.store(edge, preview, live, true);
      expect(temporaryEdgeRoute(preview, live.polygons.source, live.polygons.target).path[0]).toEqual({ x: 200 + amount, y: 150 + amount });
    }
  });
});

describe('shortening an Edge preview toward its route', () => {
  it('shortens the source side without doubling back to the original anchor', () => {
    const { input, route } = fixture();
    const preview = temporaryEdgeRoute(route, translate(input.polygons.source, 40, 0), input.polygons.target);
    expect(preview.path).toEqual([{ x: 240, y: 150 }, { x: 400, y: 150 }]);
  });

  it('shortens the target side when it moves toward the source', () => {
    const { input, route } = fixture();
    const preview = temporaryEdgeRoute(route, input.polygons.source, translate(input.polygons.target, -40, 0));
    expect(preview.path).toEqual([{ x: 200, y: 150 }, { x: 360, y: 150 }]);
  });

  it('shortens both ends independently', () => {
    const { input, route } = fixture();
    const preview = temporaryEdgeRoute(route, translate(input.polygons.source, 40, 0), translate(input.polygons.target, -40, 0));
    expect(preview.path).toEqual([{ x: 240, y: 150 }, { x: 360, y: 150 }]);
  });

  it('retains an extension when the Zone moves away from its Edge', () => {
    const { input, route } = fixture();
    const preview = temporaryEdgeRoute(route, translate(input.polygons.source, -40, 0), input.polygons.target);
    expect(preview.path).toEqual([{ x: 160, y: 150 }, { x: 200, y: 150 }, { x: 400, y: 150 }]);
  });

  it('removes consumed bends rather than connecting backward through the Zone', () => {
    const { input, route } = fixture();
    const path = [{ x: 200, y: 150 }, { x: 220, y: 150 }, { x: 220, y: 50 }, { x: 400, y: 50 }, { x: 400, y: 150 }];
    const bent = { ...route, path, data: 'M 200 150 L 220 150 L 220 50 L 400 50 L 400 150' };
    const preview = temporaryEdgeRoute(bent, translate(input.polygons.source, 40, 0), input.polygons.target);
    expect(preview.path).toEqual([{ x: 240, y: 150 }, { x: 400, y: 50 }, { x: 400, y: 150 }]);
  });

  it('adjusts a curved span without adding a backward line segment', () => {
    const { input, route } = fixture();
    const curved = { ...route, data: 'M 200 150 Q 260 100 400 150' };
    const preview = temporaryEdgeRoute(curved, translate(input.polygons.source, 40, 0), input.polygons.target);
    expect(preview.path).toEqual([{ x: 240, y: 150 }, { x: 400, y: 150 }]);
    expect(preview.data).toBe('M 240 150 Q 280 100 400 150');
  });
});
