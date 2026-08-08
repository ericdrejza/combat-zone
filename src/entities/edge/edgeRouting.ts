import type { LayoutPoint } from "@core/layout/types";
import type { EdgeShape } from "./types";
import type { Edge } from "./types";
import type { EncounterState } from "@core/encounter/types";
import {
  center,
  closestBoundaryPair,
  closestBoundaryPoint,
  distance,
  segmentDistance
} from "./edgeBoundaryGeometry";
import { optimizeOrthogonalPath } from "./edgeOrthogonalRouting";

export { getCardinalPathArrowAngle } from "./edgeBoundaryGeometry";
export { routeToSvgPath } from "./edgePathGeometry";

export const EDGE_OBSTACLE_CLEARANCE = 12;
export const EDGE_LANE_GAP = 12;

export type EdgeRoute = {
  clearance: number;
  path: LayoutPoint[];
  valid: boolean;
};

export type EdgeLanePlacement = {
  /** Fraction measured in this Edge's local from-to direction. */
  badgeFraction: number;
  /** Position relative to the canonical pair normal, used for badge staggering. */
  laneIndex: number;
  /** Offset relative to this Edge's from-to path direction. */
  routeOffset: number;
};

function edgeLaneSlot(edge: Edge): string {
  return edge.directionality === "bilateral"
    ? `bilateral:${[edge.fromZoneId, edge.toZoneId].sort().join("<->")}`
    : `unilateral:${edge.fromZoneId}->${edge.toZoneId}`;
}

type RouteInput = {
  bounds?: { height: number; width: number; x: number; y: number };
  fromPolygon: LayoutPoint[];
  obstaclePolygons: LayoutPoint[][];
  shape: EdgeShape;
  toPolygon: LayoutPoint[];
};

/** Assigns pair lanes canonically so reverse paths cannot collapse together. */
export function getEdgeLanePlacement(
  edge: Edge,
  siblings: Edge[]
): EdgeLanePlacement {
  if (siblings.length <= 1) {
    return { badgeFraction: 0.5, laneIndex: 0, routeOffset: 0 };
  }
  const [canonicalFrom] = [edge.fromZoneId, edge.toZoneId].sort();
  const rank = (candidate: Edge) =>
    candidate.directionality === "bilateral"
      ? 1
      : candidate.fromZoneId === canonicalFrom
        ? 0
        : 2;
  const ordered = [...siblings].sort((left, right) => rank(left) - rank(right));
  const siblingIndex = ordered.findIndex((candidate) =>
    candidate.id === edge.id || edgeLaneSlot(candidate) === edgeLaneSlot(edge)
  );
  const laneIndex = siblingIndex - (ordered.length - 1) / 2;
  const directionFactor = edge.fromZoneId === canonicalFrom ? 1 : -1;
  const canonicalBadgeFraction = 0.5 + laneIndex * 0.08;
  return {
    badgeFraction:
      directionFactor === 1
        ? canonicalBadgeFraction
        : 1 - canonicalBadgeFraction,
    laneIndex,
    routeOffset: laneIndex * EDGE_LANE_GAP * directionFactor
  };
}

/** Spreads a routed lane while keeping both endpoints attached to Zone boundaries. */
export function offsetRouteForLane(
  path: LayoutPoint[],
  fromPolygon: LayoutPoint[],
  toPolygon: LayoutPoint[],
  amount: number
): LayoutPoint[] {
  if (path.length < 2 || amount === 0) return path;
  const start = path[0];
  const end = path[path.length - 1];
  const length = distance(start, end) || 1;
  const normal = {
    x: -(end.y - start.y) / length,
    y: (end.x - start.x) / length
  };
  const offset = path.map((point) => ({
    x: point.x + normal.x * amount,
    y: point.y + normal.y * amount
  }));
  offset[0] = closestBoundaryPoint(fromPolygon, offset[0]);
  offset[offset.length - 1] = closestBoundaryPoint(
    toPolygon,
    offset[offset.length - 1]
  );
  return offset;
}

/** Locates badges by traveled distance instead of selecting an endpoint node. */
export function pointAlongRoute(
  path: LayoutPoint[],
  fraction: number
): LayoutPoint | undefined {
  if (path.length === 0) return undefined;
  if (path.length === 1) return path[0];
  const lengths = path.slice(1).map((point, index) => distance(path[index], point));
  const total = lengths.reduce((sum, value) => sum + value, 0);
  let remaining = total * Math.max(0, Math.min(1, fraction));
  for (let index = 0; index < lengths.length; index += 1) {
    if (remaining <= lengths[index]) {
      const start = path[index];
      const end = path[index + 1];
      const ratio = lengths[index] === 0 ? 0 : remaining / lengths[index];
      return {
        x: start.x + (end.x - start.x) * ratio,
        y: start.y + (end.y - start.y) * ratio
      };
    }
    remaining -= lengths[index];
  }
  return path[path.length - 1];
}

function pointInPolygon(point: LayoutPoint, polygon: LayoutPoint[]): boolean {
  return polygon.reduce((inside, current, index) => {
    const previous = polygon[(index + polygon.length - 1) % polygon.length];
    const crosses = current.y > point.y !== previous.y > point.y &&
      point.x < ((previous.x - current.x) * (point.y - current.y)) /
        (previous.y - current.y || Number.EPSILON) + current.x;
    return crosses ? !inside : inside;
  }, false);
}

function segmentClear(
  start: LayoutPoint,
  end: LayoutPoint,
  obstacles: LayoutPoint[][],
  clearance: number
): boolean {
  const samples = Math.max(2, Math.ceil(distance(start, end) / 4));
  for (let sample = 1; sample < samples; sample += 1) {
    const point = {
      x: start.x + ((end.x - start.x) * sample) / samples,
      y: start.y + ((end.y - start.y) * sample) / samples
    };
    if (obstacles.some((polygon) => pointInPolygon(point, polygon) || polygon.some((vertex, index) =>
      segmentDistance(point, vertex, polygon[(index + 1) % polygon.length]) <= Math.max(clearance, 0.01)
    ))) return false;
  }
  return true;
}

function expandedCandidates(polygon: LayoutPoint[], clearance: number): LayoutPoint[] {
  const polygonCenter = center(polygon);
  return polygon.map((point) => {
    const dx = point.x - polygonCenter.x;
    const dy = point.y - polygonCenter.y;
    const length = Math.hypot(dx, dy) || 1;
    const normalX = dx / length;
    const normalY = dy / length;
    const scale = clearance === 0
      ? 0
      : clearance / Math.max(Math.min(Math.abs(normalX) || 1, Math.abs(normalY) || 1), 0.25);
    return { x: point.x + normalX * scale, y: point.y + normalY * scale };
  });
}

function shortestVisibilityPath(
  start: LayoutPoint,
  end: LayoutPoint,
  obstacles: LayoutPoint[][],
  clearance: number,
  bounds: NonNullable<RouteInput["bounds"]>
): LayoutPoint[] | undefined {
  const withinBounds = (point: LayoutPoint) => point.x >= bounds.x && point.y >= bounds.y && point.x <= bounds.x + bounds.width && point.y <= bounds.y + bounds.height;
  const nodes = [start, end, ...obstacles.flatMap((polygon) => expandedCandidates(polygon, clearance)).filter(withinBounds)];
  const costs = nodes.map(() => Number.POSITIVE_INFINITY);
  const previous = nodes.map(() => -1);
  const visited = new Set<number>();
  costs[0] = 0;
  while (visited.size < nodes.length) {
    let current = -1;
    nodes.forEach((_, index) => {
      if (!visited.has(index) && (current < 0 || costs[index] < costs[current])) current = index;
    });
    if (current < 0 || !Number.isFinite(costs[current])) break;
    if (current === 1) break;
    visited.add(current);
    nodes.forEach((node, index) => {
      if (visited.has(index) || !withinBounds(node) || !segmentClear(nodes[current], node, obstacles, clearance)) return;
      const nextCost = costs[current] + distance(nodes[current], node);
      if (nextCost < costs[index]) {
        costs[index] = nextCost;
        previous[index] = current;
      }
    });
  }
  if (!Number.isFinite(costs[1])) return undefined;
  const path: LayoutPoint[] = [];
  for (let index = 1; index >= 0; index = previous[index]) {
    path.unshift(nodes[index]);
    if (index === 0) break;
  }
  return path;
}

/** Returns derived route geometry and never mutates the graph Edge. */
export function routeEdge(input: RouteInput): EdgeRoute {
  const { end, start } = closestBoundaryPair(
    input.fromPolygon,
    input.toPolygon
  );
  for (let clearance = EDGE_OBSTACLE_CLEARANCE; clearance >= 0; clearance -= 2) {
    const bounds = input.bounds ?? { height: 640, width: 960, x: 0, y: 0 };
    let path = segmentClear(start, end, input.obstaclePolygons, clearance)
      ? [start, end]
      : shortestVisibilityPath(
          start,
          end,
          input.obstaclePolygons,
          clearance,
          bounds
        );
    if (path) {
      if (path.length > 2) {
        const routedStart = closestBoundaryPoint(input.fromPolygon, path[1]);
        const routedEnd = closestBoundaryPoint(input.toPolygon, path[path.length - 2]);
        path = shortestVisibilityPath(routedStart, routedEnd, input.obstaclePolygons, clearance, bounds) ?? path;
      }
      const routedPath = input.shape === "rightAngled"
        ? optimizeOrthogonalPath(path, (routeStart, routeEnd) =>
            segmentClear(
              routeStart,
              routeEnd,
              input.obstaclePolygons,
              clearance
            )
          )
        : path;
      if (!routedPath) continue;
      return {
        clearance,
        path: routedPath,
        valid: true
      };
    }
  }
  return { clearance: 0, path: [], valid: false };
}

/** Reports renderability only; callers must not treat this as graph validity. */
export function getUnroutableEdgeIds(state: EncounterState): string[] {
  return state.edges.allIds.filter((edgeId) => {
    const edge = state.edges.byId[edgeId];
    const from = edge ? state.zones.byId[edge.fromZoneId] : undefined;
    const to = edge ? state.zones.byId[edge.toZoneId] : undefined;
    if (!edge || !from || !to) return false;
    const obstaclePolygons = state.zones.allIds
      .filter((zoneId) => zoneId !== from.id && zoneId !== to.id)
      .map((zoneId) => state.zones.byId[zoneId]?.polygon)
      .filter((polygon): polygon is LayoutPoint[] => Boolean(polygon));
    return !routeEdge({
      fromPolygon: from.polygon,
      obstaclePolygons,
      shape: edge.shape,
      toPolygon: to.polygon
    }).valid;
  });
}
