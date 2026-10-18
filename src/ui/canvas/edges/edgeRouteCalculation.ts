import { measureEdgeRouting, type EdgeRoutingMetrics } from "@entities/edge/edgeRoutingMetrics";
import type { EncounterState } from "@core/encounter/types";
import type { LayoutPoint } from "@core/layout/types";
import { getEdgeSlotKey } from "@entities/edge/edgeMutations";
import { getEdgeLanePlacement, offsetRouteForLane, routeEdge, type EdgeRoute } from "@entities/edge/edgeRouting";
import { resolveEdgeCurvePath } from "@entities/edge/resolveEdgeCurvePath";
import type { Edge } from "@entities/edge/types";

export type EdgeRouteInput = {
  encounterId: string;
  state: Pick<EncounterState, "canvasSize" | "grid" | "movementRules">;
  polygons: Record<string, LayoutPoint[]>;
  edges: Edge[];
  preview?: Edge;
  live?: boolean;
  estimateOnly?: boolean;
};
export type CalculatedEdgeRoute = {
  revision?: number;
  fromZoneId: string; toZoneId: string;
  fromPolygon: LayoutPoint[]; toPolygon: LayoutPoint[];
  path: LayoutPoint[]; data: string; automatic: boolean;
  route: EdgeRoute; badgeFraction: number;
};
export type EdgeRouteResult = { encounterId: string; byId: Record<string, CalculatedEdgeRoute> };
export type EdgeRouteRequest = { requestId: number; input: EdgeRouteInput; reset?: boolean; removedZoneIds?: string[] };
export type EdgeRouteResponse = { requestId: number; result: EdgeRouteResult; done?: boolean; metrics?: { edgeId: string; phases: EdgeRoutingMetrics; reused: boolean; repaired: boolean } };
const pairKey = (edge: Edge) => [edge.fromZoneId, edge.toZoneId].sort().join("<->");

type ReuseRoute = (edge: Edge, laneOffset: number) => CalculatedEdgeRoute | undefined;
/** Yield independently so expensive Edges cannot hold completed routes hostage. */
export function* calculateEdgeRouteEntries(input: EdgeRouteInput, reuse?: ReuseRoute, prioritize: (edge: Edge) => number = () => 0): Generator<{ edge: Edge; value: CalculatedEdgeRoute; reused: boolean }> {
  const { edges, preview, polygons, state } = input;
  const slot = (edge: Edge) => getEdgeSlotKey(edge.fromZoneId, edge.toZoneId, edge.directionality);
  const grouped = preview ? [...edges.filter(edge => slot(edge) !== slot(preview)), preview] : edges;
  const groups = new Map<string, Edge[]>();
  grouped.forEach(edge => groups.set(pairKey(edge), [...(groups.get(pairKey(edge)) ?? []), edge]));
  const reserved = new Map<string, LayoutPoint[][]>();
  const ordered = [...(preview ? [...edges, preview] : edges)].sort((a, b) => prioritize(a) - prioritize(b));
  // Priorities apply to whole sibling groups; their stable lane reservation order stays intact.
  const pairs = [...new Set(ordered.map(pairKey))];
  for (const edge of pairs.flatMap(pair => (preview ? [...edges, preview] : edges).filter(edge => pairKey(edge) === pair))) {
    const fromPolygon = polygons[edge.fromZoneId], toPolygon = polygons[edge.toZoneId];
    if (!fromPolygon || !toPolygon) continue;
    const obstacles = Object.entries(polygons).filter(([id]) => id !== edge.fromZoneId && id !== edge.toZoneId).map(([, polygon]) => polygon);
    const pair = pairKey(edge), lane = getEdgeLanePlacement(edge, groups.get(pair) ?? [edge]);
    const bounds = { x: 0, y: 0, ...state.canvasSize };
    const reused = reuse?.(edge, lane.routeOffset);
    if (reused) {
      if (reused.route.valid && reused.route.gridAligned) reserved.set(pair, [...(reserved.get(pair) ?? []), reused.route.path]);
      yield { edge, value: reused, reused: true };
      continue;
    }
    const route = measureEdgeRouting("routeSearch", () => routeEdge({ laneOffset: lane.routeOffset, gridState: state, reservedGridPaths: reserved.get(pair), bounds,
      fromPolygon, toPolygon, obstaclePolygons: obstacles, shape: edge.shape, flipped: edge.routePreferences?.flipped }));
    if (route.valid && route.gridAligned) reserved.set(pair, [...(reserved.get(pair) ?? []), route.path]);
    const path = route.valid ? offsetRouteForLane(route.path, fromPolygon, toPolygon, Math.sign(lane.routeOffset) * Math.min(Math.abs(lane.routeOffset), route.clearance)) : [];
    const geometry = route.valid ? measureEdgeRouting("curveResolution", () => resolveEdgeCurvePath({ bounds, path, shape: edge.shape, preferences: edge.routePreferences,
      polygons: [fromPolygon, toPolygon, ...obstacles], obstaclePolygons: obstacles, clearance: route.clearance })) : { data: "", automatic: true };
    yield { edge, reused: false, value: { fromZoneId: edge.fromZoneId, toZoneId: edge.toZoneId, fromPolygon, toPolygon,
      route, path, data: geometry.data, automatic: geometry.automatic, badgeFraction: lane.badgeFraction } };
  }
}

/** Pure fallback and diagnostics share the same calculator as the worker. */
export function calculateEdgeRoutes(input: EdgeRouteInput): EdgeRouteResult {
  const byId = Object.fromEntries([...calculateEdgeRouteEntries(input)].map(({ edge, value }) => [edge.id, value]));
  return { encounterId: input.encounterId, byId };
}
