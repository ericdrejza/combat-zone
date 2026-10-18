import { getEdgePathSegments } from "@entities/edge/edgeCurveGeometry";
import { getDefaultEdgePath } from "@entities/edge/edgePathGeometry";
import { isEdgePathClear, type PathSpace } from "@entities/edge/edgePathCollision";
import { optimizeOrthogonalPath } from "@entities/edge/edgeOrthogonalRouting";
import { createEdgeSegmentChecker } from "@entities/edge/edgeSegmentCollision";
import type { LayoutPoint } from "@core/layout/types";
import type { Edge } from "@entities/edge/types";
import type { CalculatedEdgeRoute } from "./edgeRouteCalculation";
import { moveAnchor } from "./temporaryEdgeRoute";

/** Deform the existing route, rather than appending endpoint connector segments. */
export function repairEdgeRoute(edge: Edge, route: CalculatedEdgeRoute, from: LayoutPoint[], to: LayoutPoint[], space: PathSpace): CalculatedEdgeRoute | undefined {
  if (!route.data || route.path.length < 2 || route.route.gridAligned) return undefined;
  const start = route.path[0], end = route.path.at(-1)!;
  const nextStart = moveAnchor(start, route.fromPolygon, from), nextEnd = moveAnchor(end, route.toPolygon, to);
  const shift = (point: LayoutPoint, t: number) => ({
    x: point.x + (nextStart.x - start.x) * (1 - t) + (nextEnd.x - end.x) * t,
    y: point.y + (nextStart.y - start.y) * (1 - t) + (nextEnd.y - end.y) * t
  });
  let path = route.path.map((point, index) => shift(point, index / (route.path.length - 1)));
  let data: string;
  if (edge.shape === "rightAngled") {
    const adjusted = optimizeOrthogonalPath(path, createEdgeSegmentChecker(space.obstaclePolygons, space.clearance, [from, to]), edge.routePreferences?.flipped);
    if (!adjusted) return undefined;
    path = adjusted;
    data = getDefaultEdgePath(path, edge.shape);
  } else {
    const parts = getEdgePathSegments(route.data);
    data = `M ${nextStart.x} ${nextStart.y} ` + parts.map((part, index) => {
      const points = [...part.controls, part.end].map((point, pointIndex) => shift(point, (index + (pointIndex + 1) / (part.controls.length + 1)) / parts.length));
      return `${part.controls.length === 2 ? "C" : part.controls.length === 1 ? "Q" : "L"} ${points.map(point => `${point.x} ${point.y}`).join(" ")}`;
    }).join(" ");
  }
  if (!isEdgePathClear(data, space)) return undefined;
  return { ...route, fromPolygon: from, toPolygon: to, data, path, route: { ...route.route, path } };
}
