import { StrictMode, type ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createEncounterState } from '@core/encounter/createEncounterState';
import { DEFAULT_EDGE_PRESET } from '@entities/edge/edgeMutations';
import { calculateEdgeRoutes, type EdgeRouteInput, type EdgeRouteRequest, type EdgeRouteResponse } from '@ui/canvas/edges/edgeRouteCalculation';
import { useEdgeRoutes } from '@ui/canvas/edges/useEdgeRoutes';

/** Each worker owns an independent geometry snapshot, just like the browser worker. */
class RoutingWorker extends EventTarget {
  static instances: RoutingWorker[] = [];
  requests: EdgeRouteRequest[] = [];
  terminated = false;
  revision = 0;
  polygons: EdgeRouteInput['polygons'] = {};
  constructor() { super(); RoutingWorker.instances.push(this); }
  postMessage(request: EdgeRouteRequest) {
    this.requests.push(request);
    queueMicrotask(() => {
      if (this.terminated) return;
      this.polygons = { ...(request.reset ? {} : this.polygons), ...request.input.polygons };
      for (const id of request.removedZoneIds ?? []) delete this.polygons[id];
      const result = calculateEdgeRoutes({ ...request.input, polygons: this.polygons });
      for (const [id, value] of Object.entries(result.byId)) {
        const route = { ...value, revision: ++this.revision };
        this.reply({ requestId: request.requestId, result: { encounterId: result.encounterId, byId: { [id]: route } }, done: false });
      }
      this.reply({ requestId: request.requestId, result: { encounterId: result.encounterId, byId: {} }, done: true });
    });
  }
  reply(data: EdgeRouteResponse) { this.dispatchEvent(new MessageEvent('message', { data })); }
  terminate() { this.terminated = true; }
}

function fixture(id = 'loaded-encounter'): EdgeRouteInput {
  const state = createEncounterState({ id, name: 'Loaded encounter' });
  const rect = (x: number) => [{ x, y: 100 }, { x: x + 100, y: 100 }, { x: x + 100, y: 200 }, { x, y: 200 }];
  return { encounterId: id, state, polygons: { source: rect(100), target: rect(400) },
    edges: [{ ...DEFAULT_EDGE_PRESET, id: 'edge', fromZoneId: 'source', toZoneId: 'target', interactionTags: [] }] };
}
const strict = ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>;

describe('edge routing worker lifecycle', () => {
  beforeEach(() => { RoutingWorker.instances = []; vi.stubGlobal('Worker', RoutingWorker); });
  afterEach(() => vi.unstubAllGlobals());

  it('renders loaded routes without any Zone gesture after the Strict Mode worker restart', async () => {
    const input = fixture();
    const { result } = renderHook(() => useEdgeRoutes(input, false), { wrapper: strict });
    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(result.current.routes.edge?.data).toBeTruthy();
    expect(RoutingWorker.instances[0].terminated).toBe(true);
    const replacement = RoutingWorker.instances.at(-1)!;
    expect(replacement.requests[0].reset).toBe(true);
    expect(Object.keys(replacement.requests[0].input.polygons)).toEqual(['source', 'target']);
  });

  it('restarts with full geometry after the Edge collection becomes empty', async () => {
    const input = fixture();
    const { result, rerender } = renderHook(({ value }) => useEdgeRoutes(value, false), { initialProps: { value: input } });
    await waitFor(() => expect(result.current.routes.edge?.data).toBeTruthy());
    rerender({ value: { ...input, edges: [] } });
    const moved = { ...input, polygons: { ...input.polygons, source: input.polygons.source.map(point => ({ x: point.x, y: point.y + 40 })) } };
    rerender({ value: moved });
    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(result.current.routes.edge?.data).toBeTruthy();
    expect(result.current.routes.edge.fromPolygon).toEqual(moved.polygons.source);
    expect(RoutingWorker.instances.at(-1)!.requests[0].reset).toBe(true);
  });

  it('sends complete geometry to a replacement worker after an error', async () => {
    const input = fixture();
    const { result, rerender } = renderHook(({ value }) => useEdgeRoutes(value, false), { initialProps: { value: input } });
    await waitFor(() => expect(result.current.pending).toBe(false));
    act(() => RoutingWorker.instances[0].dispatchEvent(new Event('error')));
    const moved = { ...input, polygons: { ...input.polygons, target: input.polygons.target.map(point => ({ x: point.x, y: point.y + 40 })) } };
    rerender({ value: moved });
    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(result.current.routes.edge.toPolygon).toEqual(moved.polygons.target);
    expect(RoutingWorker.instances.at(-1)!.requests[0].input.polygons).toEqual(moved.polygons);
  });

  it('loads another encounter without accepting late replies from the previous one', async () => {
    const input = fixture();
    const { result, rerender } = renderHook(({ value }) => useEdgeRoutes(value, false), { initialProps: { value: input } });
    await waitFor(() => expect(result.current.pending).toBe(false));
    const worker = RoutingWorker.instances[0], old = worker.requests[0];
    rerender({ value: fixture('another-encounter') });
    await waitFor(() => expect(result.current.pending).toBe(false));
    act(() => worker.reply({ requestId: old.requestId, result: { encounterId: input.encounterId, byId: {} }, done: true }));
    expect(result.current.routes.edge?.data).toBeTruthy();
    expect(worker.requests.at(-1)!.reset).toBe(true);
  });
});
