import { edgeGeometryKey } from "./edgeGeometryKey";
import { offsetRouteForLane } from "./edgeLaneGeometry";
import { optimizeOrthogonalPath } from "./edgeOrthogonalRouting";
import type { LayoutPoint } from "@core/layout/types";
import { distanceToPolygonBoundary, isPointInPolygon } from "@core/layout/polygonGeometry";
import { closestBoundaryPair, distance } from "./edgeBoundaryGeometry";
import { expandedCandidates } from "./edgeVisibilityRouting";
import { getEdgePathLength, isEdgePathClear } from "./edgePathCollision";
import { resolveEdgeCurvePath } from "./resolveEdgeCurvePath";
import { createEdgeSegmentChecker } from "./edgeSegmentCollision";
import type { EdgeShape } from "./types";

type Input = {
  fromPolygon: LayoutPoint[];
  toPolygon: LayoutPoint[];
  obstaclePolygons: LayoutPoint[][];
  shape: EdgeShape;
  flipped?: boolean;
  laneOffset?: number;
  bounds: { x: number; y: number; width: number; height: number };
};
const key = (point: LayoutPoint) => `${point.x.toFixed(6)},${point.y.toFixed(6)}`;

/** Uniform perimeter samples slide along long sides without over-weighting dense circle vertices. */
function attachments(polygon: LayoutPoint[], nearest: LayoutPoint): LayoutPoint[] {
  const lengths = polygon.map((point, index) => distance(point, polygon[(index + 1) % polygon.length]));
  const perimeter = lengths.reduce((sum, length) => sum + length, 0);
  const candidates = [nearest];
  if (polygon.length <= 12) candidates.push(...polygon);
  else for (const axis of ["x", "y"] as const) {
    candidates.push(polygon.reduce((a, b) => a[axis] < b[axis] ? a : b), polygon.reduce((a, b) => a[axis] > b[axis] ? a : b));
  }
  for (let sample = 0; sample < 16; sample++) {
    let remaining = perimeter * sample / 16;
    for (let index = 0; index < polygon.length; index++) {
      if (remaining <= lengths[index]) {
        const a = polygon[index], b = polygon[(index + 1) % polygon.length];
        const ratio = lengths[index] ? remaining / lengths[index] : 0;
        candidates.push({ x: a.x + (b.x - a.x) * ratio, y: a.y + (b.y - a.y) * ratio });
        break;
      }
      remaining -= lengths[index];
    }
  }
  return [...new Map(candidates.map(point => [key(point), point])).values()];
}

/** Search all source/target ports together; endpoint Zones block paths through their interiors. */
function visibilityRoute(input: Input, starts: LayoutPoint[], ends: LayoutPoint[], clearance: number, gentle: boolean): LayoutPoint[] | undefined {
  const { bounds } = input;
  const inBounds = (p: LayoutPoint) => p.x >= bounds.x && p.y >= bounds.y && p.x <= bounds.x + bounds.width && p.y <= bounds.y + bounds.height;
  const nodes = [...starts, ...ends, ...input.obstaclePolygons.flatMap(polygon => expandedCandidates(polygon, clearance)).filter(inBounds)];
  const clear = createEdgeSegmentChecker(input.obstaclePolygons, clearance, [input.fromPolygon, input.toPolygon]);
  const remaining = nodes.map(point => Math.min(...ends.map(end => distance(point, end))));
  const costs = nodes.map((_, index) => index < starts.length && inBounds(nodes[index]) ? 0 : Infinity);
  const previous = nodes.map(() => -1), visited = new Set<number>();
  while (visited.size < nodes.length) {
    let current = -1;
    for (let index = 0; index < nodes.length; index++) if (!visited.has(index) && (current < 0 || costs[index] + remaining[index] < costs[current] + remaining[current])) current = index;
    if (current < 0 || !Number.isFinite(costs[current])) break;
    visited.add(current);
    if (current >= starts.length && current < starts.length + ends.length) {
      const path: LayoutPoint[] = [];
      for (let index = current; index >= 0; index = previous[index]) path.unshift(nodes[index]);
      const candidate = preparePath(input, path, clearance, gentle);
      if (candidate) return candidate.path;
      continue;
    }
    for (let index = starts.length; index < nodes.length; index++) {
      if (visited.has(index) || !inBounds(nodes[index])) continue;
      const length = distance(nodes[current], nodes[index]);
      if (length < 1e-6 || costs[current] + length >= costs[index]) continue;
      const a = nodes[current], b = nodes[index];
      if (!clear(a, b)) continue;
      costs[index] = costs[current] + length; previous[index] = current;
    }
  }
  return undefined;
}

function preparePath(input: Input, path: LayoutPoint[], clearance: number, gentle: boolean): { path: LayoutPoint[]; data: string } | undefined {
  const space = { ...input, clearance, polygons: [input.fromPolygon, input.toPolygon, ...input.obstaclePolygons] };
  const candidate = input.shape === "rightAngled" ? optimizeOrthogonalPath(path, (a, b) => isEdgePathClear(`M ${a.x} ${a.y} L ${b.x} ${b.y}`, space), input.flipped) : path;
  if (!candidate || candidate.length < 2) return undefined;
  const offset = input.laneOffset ?? 0;
  const adjusted = offsetRouteForLane(candidate, input.fromPolygon, input.toPolygon, Math.sign(offset) * Math.min(Math.abs(offset), clearance));
  const result = resolveEdgeCurvePath({ ...space, automaticCurvatureLimit: gentle ? 1 : undefined, path: adjusted, preferences: { flipped: input.flipped ?? false, curvature: 1 } });
  const curved = input.shape === "curved" || input.shape === "sigmoid";
  return result.data && (curved || isEdgePathClear(result.data, space)) ? { path: candidate, data: result.data } : undefined;
}

type Result = { path: LayoutPoint[]; clearance: number; valid: boolean };
const routeCache = new Map<string, Result>();

/** Cache by geometry, so unrelated renders reuse routes while Zone movement invalidates them. */
export function routeBetweenZoneBoundaries(input: Input): Result {
  const key = JSON.stringify([input.shape, input.flipped ?? false, input.laneOffset ?? 0, input.bounds, edgeGeometryKey([input.fromPolygon, input.toPolygon, ...input.obstaclePolygons])]);
  const cached = routeCache.get(key);
  if (cached) return cached;
  const result = findBoundaryRoute(input);
  if (routeCache.size >= 128) routeCache.delete(routeCache.keys().next().value!);
  routeCache.set(key, result);
  return result;
}

/** Prefer a clear cohesive curve; otherwise route from the best available boundary ports. */
function findBoundaryRoute(input: Input): Result {
  const nearest = closestBoundaryPair(input.fromPolygon, input.toPolygon);
  const exposed = (point: LayoutPoint, other: LayoutPoint[]) => ![other, ...input.obstaclePolygons].some(polygon =>
    isPointInPolygon(point, polygon) && distanceToPolygonBoundary(point, polygon) > 1e-6);
  const starts = attachments(input.fromPolygon, nearest.start).filter(point => exposed(point, input.toPolygon));
  const ends = attachments(input.toPolygon, nearest.end).filter(point => exposed(point, input.fromPolygon));
  // An enclosed endpoint cannot be reached without crossing a Zone. In
  // particular, the free-pointer target begins inside its source on pointerdown.
  if (!starts.length || !ends.length) return { path: [], clearance: 0, valid: false };
  const pairs = starts.flatMap(start => ends.map(end => ({ start, end, distance: distance(start, end) }))).sort((a, b) => a.distance - b.distance);
  const curved = input.shape === "curved" || input.shape === "sigmoid";
  for (let clearance = 12; clearance >= 0; clearance -= 2) {
    const clear = createEdgeSegmentChecker(input.obstaclePolygons, clearance);
    // Near a hovered Zone, the free-pointer target can have no port at this
    // clearance. Searching the entire visibility graph cannot change that.
    const availableStarts = input.laneOffset ? starts : starts.filter(point => clear(point, point));
    const availableEnds = input.laneOffset ? ends : ends.filter(point => clear(point, point));
    if (!availableStarts.length || !availableEnds.length) continue;
    // Search every attachment with normal/reduced curvature before allowing
    // any attachment to compensate with an increased bend.
    for (const gentle of curved ? [true, false] : [false]) {
      let best: { path: LayoutPoint[]; length: number } | undefined;
      for (const pair of pairs) {
        if (!availableStarts.includes(pair.start) || !availableEnds.includes(pair.end)) continue;
        if (pair.distance < 1e-6) continue;
        // Projection back to a boundary moves each offset endpoint by at most
        // twice the lane offset. Even the best curve cannot beat this lower bound.
        const laneBound = 4 * Math.min(Math.abs(input.laneOffset ?? 0), clearance);
        if (best && pair.distance - laneBound >= best.length) break;
        const candidate = preparePath(input, [pair.start, pair.end], clearance, gentle);
        if (!candidate) continue;
        const length = getEdgePathLength(candidate.data);
        if (!best || length < best.length) best = { path: candidate.path, length };
      }
      if (best) return { path: best.path, clearance, valid: true };
      const path = visibilityRoute(input, availableStarts, availableEnds, clearance, gentle);
      if (path) return { path, clearance, valid: true };
    }
  }
  return { path: [], clearance: 0, valid: false };
}
