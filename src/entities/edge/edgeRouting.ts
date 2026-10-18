import { routeBetweenZoneBoundaries } from "./edgeCurveBoundaryRouting";
import { hasEnclosedEdgeEndpoint } from "./edgeEndpointContainment";
import { isEdgePathClear } from "./edgePathCollision";
import { segmentClear, shortestVisibilityPath } from "./edgeVisibilityRouting";
import { resolveEdgeCurvePath } from "./resolveEdgeCurvePath";
import { routeEdgeOnGrid } from "./edgeGridRouting";
import type { LayoutPoint } from "@core/layout/types";
import type { EdgeShape } from "./types";
import type { Edge } from "./types";
import type { EncounterState } from "@core/encounter/types";
import {
  closestBoundaryPair,
  closestBoundaryPoint,
  distance
} from "./edgeBoundaryGeometry";
import { optimizeOrthogonalPath } from "./edgeOrthogonalRouting";

export { getCardinalPathArrowAngle } from "./edgeBoundaryGeometry";
export { offsetRouteForLane } from "./edgeLaneGeometry";
export { routeToSvgPath } from "./edgePathGeometry";

export const EDGE_OBSTACLE_CLEARANCE = 12;
export const EDGE_LANE_GAP = 12;

export type EdgeRoute = {
  gridAligned?: boolean;
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
  gridState?: Pick<EncounterState, "grid" | "canvasSize" | "movementRules">;
  reservedGridPaths?: LayoutPoint[][];
  flipped?: boolean;
  laneOffset?: number;
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

/** Returns derived route geometry and never mutates the graph Edge. */
export function routeEdge(input: RouteInput): EdgeRoute {
  if (hasEnclosedEdgeEndpoint(input.fromPolygon, input.toPolygon, input.obstaclePolygons)) return { path: [], clearance: 0, valid: false };
  if (input.shape === "rightAngled" && input.gridState?.movementRules.snapZoneVertices && input.gridState.grid.type === "square") {
    const path = routeEdgeOnGrid(input.gridState, input.fromPolygon, input.toPolygon, input.obstaclePolygons, input.flipped, input.reservedGridPaths);
    return { gridAligned: true, clearance: 0, path: path ?? [], valid: Boolean(path) };
  }
  const bounds = input.bounds ?? { height: 640, width: 960, x: 0, y: 0 };
  if (input.shape === "curved" || input.shape === "sigmoid") return routeBetweenZoneBoundaries({ ...input, bounds });
  const { end, start } = closestBoundaryPair(
    input.fromPolygon,
    input.toPolygon
  );
  for (let clearance = EDGE_OBSTACLE_CLEARANCE; clearance >= 0; clearance -= 2) {
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
            ), input.flipped
          )
        : path;
      if (!routedPath || !isEdgePathClear(`M ${routedPath.map(point => `${point.x} ${point.y}`).join(" L ")}`, {
        bounds, clearance, obstaclePolygons: input.obstaclePolygons,
        polygons: [input.fromPolygon, input.toPolygon, ...input.obstaclePolygons]
      })) continue;
      return {
        clearance,
        path: routedPath,
        valid: true
      };
    }
  }
  return routeBetweenZoneBoundaries({ ...input, bounds });
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
    const bounds = { x: 0, y: 0, ...state.canvasSize };
    const route = routeEdge({ gridState: state, bounds,
      fromPolygon: from.polygon, obstaclePolygons, shape: edge.shape,
      flipped: edge.routePreferences?.flipped, toPolygon: to.polygon });
    return !route.valid || !resolveEdgeCurvePath({ path: route.path, shape: edge.shape,
      preferences: edge.routePreferences, bounds, clearance: route.clearance,
      polygons: [from.polygon, to.polygon, ...obstaclePolygons], obstaclePolygons }).data;
  });
}
