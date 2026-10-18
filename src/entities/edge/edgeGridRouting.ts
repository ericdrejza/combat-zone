import { edgeGeometryKey } from "./edgeGeometryKey";
import { measureEdgeRouting } from "./edgeRoutingMetrics";
import { EdgeRouteQueue } from "./edgeRouteQueue";
import { createEdgeSegmentChecker } from "./edgeSegmentCollision";
import type { EncounterState } from "@core/encounter/types";
import type { LayoutPoint } from "@core/layout/types";
import { distanceToPolygonBoundary, getPolygonBounds, isPointInPolygon, segmentsIntersect } from "@core/layout/polygonGeometry";
import { buildCellGraph, compressCellRoute, type CellGraph } from "@core/movement/cellTracer";
import { anchorKey } from "@core/movement/gridTopology";

type Region = { minX: number; minY: number; maxX: number; maxY: number };
const graphCache = new Map<string, CellGraph>();
function graphFor(state: Pick<EncounterState, "grid" | "canvasSize">, region?: Region) {
  const { type, origin, rotation, isometricAngle, warp } = state.grid;
  const key = JSON.stringify([type, origin, rotation, isometricAngle, warp, state.canvasSize, region]);
  let graph = graphCache.get(key);
  if (!graph) {
    graph = measureEdgeRouting("gridBuild", () => buildCellGraph(state, region));
    if (graphCache.size >= 8) graphCache.delete(graphCache.keys().next().value!);
    graphCache.set(key, graph);
  }
  return graph;
}
const distance = (a: LayoutPoint, b: LayoutPoint) => Math.hypot(a.x - b.x, a.y - b.y);
function boundaryCuts(a: LayoutPoint, b: LayoutPoint, polygon: LayoutPoint[]): LayoutPoint[] {
  const dx = b.x - a.x, dy = b.y - a.y;
  return polygon.flatMap((c, index) => {
    const d = polygon[(index + 1) % polygon.length];
    const ex = d.x - c.x, ey = d.y - c.y;
    const denominator = dx * ey - dy * ex;
    if (Math.abs(denominator) < 1e-9) {
      if (Math.abs((c.x - a.x) * dy - (c.y - a.y) * dx) > 1e-6) return [];
      return [c, d].filter(p => (p.x - a.x) * dx + (p.y - a.y) * dy >= -1e-6 && (p.x - b.x) * dx + (p.y - b.y) * dy <= 1e-6);
    }
    const t = ((c.x - a.x) * ey - (c.y - a.y) * ex) / denominator;
    const u = ((c.x - a.x) * dy - (c.y - a.y) * dx) / denominator;
    return t >= -1e-7 && t <= 1 + 1e-7 && u >= -1e-7 && u <= 1 + 1e-7 ? [{ x: a.x + t * dx, y: a.y + t * dy }] : [];
  });
}

type RouteNode = { id: string; direction?: number; turns: number; length: number; previous?: RouteNode };
const compare = (a: RouteNode, b: RouteNode) => a.turns - b.turns || a.length - b.length;

const routeCache = new Map<string, LayoutPoint[] | undefined>();

/** Reuse derived grid routes across preview, validation, and unrelated renders. */
export function routeEdgeOnGrid(state: Pick<EncounterState, "grid" | "canvasSize">, from: LayoutPoint[], to: LayoutPoint[], obstacles: LayoutPoint[][], flipped = false, reserved: LayoutPoint[][] = []): LayoutPoint[] | undefined {
  const key = JSON.stringify([state.grid, state.canvasSize, edgeGeometryKey([from, to, ...obstacles]), flipped, reserved]);
  if (routeCache.has(key)) return routeCache.get(key);
  const endpointBounds = getPolygonBounds([...from, ...to]);
  const region = { minX: Math.max(0, Math.floor(endpointBounds.minX / 256) * 256 - 128), minY: Math.max(0, Math.floor(endpointBounds.minY / 256) * 256 - 128),
    maxX: Math.min(state.canvasSize.width, Math.ceil(endpointBounds.maxX / 256) * 256 + 128), maxY: Math.min(state.canvasSize.height, Math.ceil(endpointBounds.maxY / 256) * 256 + 128) };
  const local = measureEdgeRouting("gridSearch", () => findGridRoute(state, from, to, obstacles, flipped, reserved, region));
  // A straight or single-elbow route is globally optimal in turn count; every
  // such route lies within the endpoint bounds. Harder detours retain full search.
  const result = local && local.length <= 3 ? local : measureEdgeRouting("gridSearch", () => findGridRoute(state, from, to, obstacles, flipped, reserved));
  if (routeCache.size >= 64) routeCache.delete(routeCache.keys().next().value!);
  routeCache.set(key, result);
  return result;
}

/** Multi-source routing attaches to real Zone/grid intersections, including curved boundaries. */
function findGridRoute(state: Pick<EncounterState, "grid" | "canvasSize">, from: LayoutPoint[], to: LayoutPoint[], obstacles: LayoutPoint[][], flipped: boolean, reserved: LayoutPoint[][], region?: Region): LayoutPoint[] | undefined {
  const lattice = graphFor(state, region);
  const points = new Map<string, LayoutPoint>();
  const links = new Map<string, Set<string>>();
  const sources = new Set<string>(), targets = new Set<string>();
  const polygons = [from, to, ...obstacles].map(polygon => ({ polygon, bounds: getPolygonBounds(polygon) }));
  const near = (a: LayoutPoint, b: LayoutPoint, bounds: ReturnType<typeof getPolygonBounds>) =>
    Math.max(a.x, b.x) >= bounds.minX - 1e-5 && Math.min(a.x, b.x) <= bounds.maxX + 1e-5 && Math.max(a.y, b.y) >= bounds.minY - 1e-5 && Math.min(a.y, b.y) <= bounds.maxY + 1e-5;
  function add(point: LayoutPoint) {
    const id = anchorKey(point);
    if (points.has(id)) return id;
    points.set(id, point);
    if (near(point, point, polygons[0].bounds) && distanceToPolygonBoundary(point, from) < 1e-5) sources.add(id);
    if (near(point, point, polygons[1].bounds) && distanceToPolygonBoundary(point, to) < 1e-5) targets.add(id);
    return id;
  }
  for (const [id, adjacent] of lattice.neighbors) for (const next of adjacent) {
    if (id >= next) continue;
    const a = lattice.points.get(id)!, b = lattice.points.get(next)!;
    const split = [...new Map([a, b, ...(near(a, b, polygons[0].bounds) ? boundaryCuts(a, b, from) : []), ...(near(a, b, polygons[1].bounds) ? boundaryCuts(a, b, to) : [])].map(p => [anchorKey(p), p])).values()].sort((left, right) => distance(a, left) - distance(a, right));
    for (let index = 1; index < split.length; index++) {
      const first = split[index - 1], last = split[index];
      if (distance(first, last) < 1e-6) continue;
      const midpoint = { x: (first.x + last.x) / 2, y: (first.y + last.y) / 2 };
      if (polygons.some(({ polygon, bounds }) => near(first, last, bounds) && (isPointInPolygon(midpoint, polygon) && distanceToPolygonBoundary(midpoint, polygon) > 1e-6 || polygon.some((p, i) => segmentsIntersect(first, last, p, polygon[(i + 1) % polygon.length]))))) continue;
      const firstId = add(first), lastId = add(last);
      if (!links.has(firstId)) links.set(firstId, new Set());
      if (!links.has(lastId)) links.set(lastId, new Set());
      links.get(firstId)!.add(lastId); links.get(lastId)!.add(firstId);
    }
  }
  const overlapsReserved = (a: LayoutPoint, b: LayoutPoint) => reserved.some(path => path.some((c, index) => {
    const d = path[index + 1];
    if (!d) return false;
    const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy);
    if (Math.abs((c.x - a.x) * dy - (c.y - a.y) * dx) > 1e-5 || Math.abs((d.x - a.x) * dy - (d.y - a.y) * dx) > 1e-5) return false;
    const first = ((c.x - a.x) * dx + (c.y - a.y) * dy) / length;
    const last = ((d.x - a.x) * dx + (d.y - a.y) * dy) / length;
    return Math.min(length, Math.max(first, last)) - Math.max(0, Math.min(first, last)) > 1e-5;
  }));
  const obstacleClear = createEdgeSegmentChecker(obstacles, 12);
  const blockedLinks = new Map<string, boolean>();
  for (const separate of reserved.length ? (region ? [true] : [true, false]) : [false]) for (const clearance of region ? [12] : [12, 0]) {
    const frontier = new EdgeRouteQueue<RouteNode>((a, b) => compare(a, b) || (flipped ? -1 : 1) * a.id.localeCompare(b.id));
    const best = new Map<string, RouteNode>();
    const push = (node: RouteNode) => {
      const key = `${node.id}:${node.direction}`, previous = best.get(key);
      if (previous && compare(previous, node) <= 0) return;
      best.set(key, node); frontier.push(node);
    };
    sources.forEach(id => push({ id, turns: 0, length: 0 }));
    while (frontier.size) {
      const current = frontier.pop()!;
      if (best.get(`${current.id}:${current.direction}`) !== current) continue;
      if (targets.has(current.id) && current.previous) {
        const path: LayoutPoint[] = [];
        for (let node: RouteNode | undefined = current; node; node = node.previous) path.push(points.get(node.id)!);
        return compressCellRoute(path.reverse());
      }
      const a = points.get(current.id)!;
      for (const id of links.get(current.id) ?? []) {
        const b = points.get(id)!;
        if (separate && overlapsReserved(a, b)) continue;
        if (clearance) {
          const key = [current.id, id].sort().join("->");
          if (!blockedLinks.has(key)) blockedLinks.set(key, !obstacleClear(a, b));
          if (blockedLinks.get(key)) continue;
        }
        const direction = Math.round(Math.atan2(b.y - a.y, b.x - a.x) * 1e6);
        push({ id, direction, turns: current.turns + (current.direction !== undefined && current.direction !== direction ? 1 : 0), length: current.length + distance(a, b), previous: current });
      }
    }
  }
  return undefined;
}
