import { getPolygonBounds } from "@core/layout/polygonGeometry";
import type { LayoutPoint } from "@core/layout/types";
import { getEdgePathSegments } from "@entities/edge/edgeCurveGeometry";
import { measureEdgeRouting } from "@entities/edge/edgeRoutingMetrics";
import type { Edge } from "@entities/edge/types";
import type { CalculatedEdgeRoute, EdgeRouteInput } from "./edgeRouteCalculation";
import { repairEdgeRoute } from "./repairEdgeRoute";
import { pendingEdgeRoute, temporaryEdgeRoute } from "./temporaryEdgeRoute";

type Entry = { route: CalculatedEdgeRoute; polygons: EdgeRouteInput["polygons"]; signature: string; draft: boolean };
const pair = (edge: Edge) => [edge.fromZoneId, edge.toZoneId].sort().join("<->");
const samePolygon = (a: LayoutPoint[] | undefined, b: LayoutPoint[] | undefined) => a === b || Boolean(a && b && a.length === b.length && a.every((p, i) => p.x === b[i].x && p.y === b[i].y));

/** Worker-owned derived cache. Geometry identities survive structured-cloned messages. */
export class EdgeRouteSession {
  private encounterId?: string;
  private polygons: EdgeRouteInput["polygons"] = {};
  private entries = new Map<string, Entry>();
  private signatures = new Map<string, string>();
  private affectedPairs = new Set<string>();
  readonly repaired = new Set<string>();
  private provisional = new Set<string>();

  prepare(input: EdgeRouteInput) {
    if (this.encounterId !== input.encounterId) { this.entries.clear(); this.polygons = {}; this.encounterId = input.encounterId; }
    const next = Object.fromEntries(Object.entries(input.polygons).map(([id, polygon]) => [id, samePolygon(this.polygons[id], polygon) ? this.polygons[id] : polygon]));
    this.polygons = next;
    input.polygons = next;
    this.repaired.clear(); this.provisional.clear(); this.affectedPairs.clear(); this.signatures.clear();
    const edges = input.preview ? [...input.edges, input.preview] : input.edges;
    const config = JSON.stringify([input.state.canvasSize, input.state.grid, input.state.movementRules.snapZoneVertices]);
    for (const edge of edges) {
      const siblings = edges.filter(other => pair(other) === pair(edge));
      this.signatures.set(edge.id, JSON.stringify([config, siblings.map(other => [other.id, other.fromZoneId, other.toZoneId, other.directionality, other.shape, other.routePreferences])]));
      if (this.affected(edge, input)) this.affectedPairs.add(pair(edge));
    }
    const ids = new Set(edges.map(edge => edge.id));
    for (const id of this.entries.keys()) if (!ids.has(id)) this.entries.delete(id);
  }

  private affected(edge: Edge, input: EdgeRouteInput): boolean {
    const entry = this.entries.get(edge.id);
    if (!entry || entry.signature !== this.signatures.get(edge.id) || (!input.live && entry.draft)) return true;
    if (entry.polygons[edge.fromZoneId] !== input.polygons[edge.fromZoneId] || entry.polygons[edge.toZoneId] !== input.polygons[edge.toZoneId]) return true;
    const ids = new Set([...Object.keys(entry.polygons), ...Object.keys(input.polygons)]);
    const changed = [...ids].filter(id => entry.polygons[id] !== input.polygons[id]);
    if (!changed.length) return false;
    if (!entry.route.data) return true;
    // Include endpoint interiors and curve controls, not just its endpoint segment.
    const points = getEdgePathSegments(entry.route.data).flatMap(part => [part.start, ...part.controls, part.end]);
    const bounds = getPolygonBounds([...points, ...entry.route.fromPolygon, ...entry.route.toPolygon]);
    const margin = 12;
    return changed.some(id => [entry.polygons[id], input.polygons[id]].some(polygon => {
      if (!polygon) return false;
      const b = getPolygonBounds(polygon);
      return b.maxX >= bounds.minX - margin && b.minX <= bounds.maxX + margin && b.maxY >= bounds.minY - margin && b.minY <= bounds.maxY + margin;
    }));
  }

  priority(edge: Edge, input: EdgeRouteInput) {
    const entry = this.entries.get(edge.id);
    if (!entry || entry.polygons[edge.fromZoneId] !== input.polygons[edge.fromZoneId] || entry.polygons[edge.toZoneId] !== input.polygons[edge.toZoneId]) return 0;
    return this.affectedPairs.has(pair(edge)) ? 1 : 2;
  }

  reuse(edge: Edge, input: EdgeRouteInput): CalculatedEdgeRoute | undefined {
    const entry = this.entries.get(edge.id);
    if (!this.affectedPairs.has(pair(edge))) return entry?.route;
    if (!input.live || !input.estimateOnly) return undefined;
    const from = input.polygons[edge.fromZoneId], to = input.polygons[edge.toZoneId];
    if (!from || !to) return undefined;
    if (!entry || entry.signature !== this.signatures.get(edge.id)) {
      this.repaired.add(edge.id);
      return pendingEdgeRoute(edge, from, to, entry?.route.badgeFraction ?? 0.5);
    }
    const obstacles = Object.entries(input.polygons).filter(([id]) => id !== edge.fromZoneId && id !== edge.toZoneId).map(([, polygon]) => polygon);
    const repaired = measureEdgeRouting("localRepair", () => repairEdgeRoute(edge, entry.route, from, to, {
      bounds: { x: 0, y: 0, ...input.state.canvasSize }, polygons: [from, to, ...obstacles], obstaclePolygons: obstacles, clearance: entry.route.route.clearance
    }));
    this.repaired.add(edge.id);
    if (!repaired) this.provisional.add(edge.id);
    return repaired ?? { ...entry.route, ...temporaryEdgeRoute(entry.route, from, to) };
  }

  store(edge: Edge, route: CalculatedEdgeRoute, input: EdgeRouteInput, reused: boolean) {
    // Provisional previews carry updated anchor geometry but leave the cached
    // route baseline intact for the next repair attempt.
    if (reused && (!this.repaired.has(edge.id) || this.provisional.has(edge.id))) return;
    this.entries.set(edge.id, { route, polygons: input.polygons, signature: this.signatures.get(edge.id)!, draft: Boolean(input.live) });
  }
}
