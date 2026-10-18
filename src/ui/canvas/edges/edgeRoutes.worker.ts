import { collectEdgeRoutingMetrics } from "@entities/edge/edgeRoutingMetrics";
import { calculateEdgeRouteEntries, type EdgeRouteInput, type EdgeRouteRequest, type EdgeRouteResponse } from "./edgeRouteCalculation";
import { EdgeRouteSession } from "./edgeRouteSession";

const session = new EdgeRouteSession();
let polygons: EdgeRouteInput["polygons"] = {};
let generation = 0;
let routeRevision = 0;
self.addEventListener("message", async (event: MessageEvent<EdgeRouteRequest>) => {
  const current = ++generation;
  const { requestId, input, reset, removedZoneIds } = event.data;
  polygons = { ...(reset ? {} : polygons), ...input.polygons };
  for (const id of removedZoneIds ?? []) delete polygons[id];
  const snapshot = { ...input, polygons };
  session.prepare(snapshot);
  const entries = calculateEdgeRouteEntries(snapshot, edge => session.reuse(edge, snapshot), edge => session.priority(edge, snapshot));
  while (current === generation) {
    const { value: next, metrics } = collectEdgeRoutingMetrics(() => entries.next());
    if (next.done) {
      self.postMessage({ requestId, result: { encounterId: snapshot.encounterId, byId: {} }, done: true } satisfies EdgeRouteResponse);
      return;
    }
    const { edge, value, reused } = next.value;
    if (value.revision === undefined || !reused || session.repaired.has(edge.id)) value.revision = ++routeRevision;
    session.store(edge, value, snapshot, reused);
    self.postMessage({ requestId, result: { encounterId: snapshot.encounterId, byId: { [edge.id]: value } }, done: false,
      metrics: { edgeId: edge.id, phases: metrics, reused, repaired: session.repaired.has(edge.id) } } satisfies EdgeRouteResponse);
    // Let a newer pointer snapshot supersede unfinished work between Edges.
    if (!reused || session.repaired.has(edge.id)) await new Promise(resolve => setTimeout(resolve, 0));
  }
});
