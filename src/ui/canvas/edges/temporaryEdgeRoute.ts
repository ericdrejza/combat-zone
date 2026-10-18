import { getEdgePathSegments } from "@entities/edge/edgeCurveGeometry";
import { adjustPreviewEndpoint, reversePreviewSegments } from "./adjustPreviewEndpoint";
import type { LayoutPoint } from "@core/layout/types";
import { center, closestBoundaryPoint, segmentDistance } from "@entities/edge/edgeBoundaryGeometry";
import { getPolygonBounds } from "@core/layout/polygonGeometry";
import { getDefaultEdgePath } from "@entities/edge/edgePathGeometry";
import type { Edge } from "@entities/edge/types";
import type { CalculatedEdgeRoute } from "./edgeRouteCalculation";

/** First-load placeholders need only boundary projections, never a route search. */
export function pendingEdgeRoute(edge: Edge, fromPolygon: LayoutPoint[], toPolygon: LayoutPoint[], badgeFraction: number): CalculatedEdgeRoute {
  const path = [closestBoundaryPoint(fromPolygon, center(toPolygon)), closestBoundaryPoint(toPolygon, center(fromPolygon))];
  return { fromZoneId: edge.fromZoneId, toZoneId: edge.toZoneId, fromPolygon, toPolygon, path,
    data: getDefaultEdgePath(path, edge.shape), automatic: true, badgeFraction,
    route: { path, clearance: 0, valid: true } };
}

/** Translate with the Zone, but keep side anchors fixed when resizing leaves them on that side. */
export function moveAnchor(point: LayoutPoint, before: LayoutPoint[], after: LayoutPoint[]): LayoutPoint {
  if (!before.length || !after.length) return point;
  if (before.length === after.length) {
    const delta = { x: after[0].x - before[0].x, y: after[0].y - before[0].y };
    if (before.every((vertex, index) => Math.hypot(after[index].x - vertex.x - delta.x, after[index].y - vertex.y - delta.y) < 1e-6)) {
      return { x: point.x + delta.x, y: point.y + delta.y };
    }
    let side = 0, nearest = Infinity;
    before.forEach((a, index) => {
      const distance = segmentDistance(point, a, before[(index + 1) % before.length]);
      if (distance < nearest) { nearest = distance; side = index; }
    });
    const a = before[side], b = before[(side + 1) % before.length];
    const squared = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
    const t = squared ? Math.max(0, Math.min(1, ((point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y)) / squared)) : 0;
    const c = after[side], d = after[(side + 1) % after.length];
    if (t > 1e-6 && t < 1 - 1e-6 && segmentDistance(point, c, d) < 1e-6) return point;
    return { x: c.x + (d.x - c.x) * t, y: c.y + (d.y - c.y) * t };
  }
  const old = getPolygonBounds(before), next = getPolygonBounds(after);
  return closestBoundaryPoint(after, {
    x: next.minX + (point.x - old.minX) / (old.maxX - old.minX || 1) * (next.maxX - next.minX),
    y: next.minY + (point.y - old.minY) / (old.maxY - old.minY || 1) * (next.maxY - next.minY)
  });
}

/** Associate preview anchors with their geometry so corrections never double up. */
export function temporaryEdgeRoute(route: CalculatedEdgeRoute, from: LayoutPoint[], to: LayoutPoint[]) {
  const geometry = { fromPolygon: from, toPolygon: to };
  if (!route.data || route.path.length < 2) return { ...geometry, data: route.data, path: route.path };
  const oldStart = route.path[0], oldEnd = route.path.at(-1)!;
  const start = moveAnchor(oldStart, route.fromPolygon, from), end = moveAnchor(oldEnd, route.toPolygon, to);
  const moved = (a: LayoutPoint, b: LayoutPoint) => Math.hypot(a.x - b.x, a.y - b.y) > 1e-6;
  if (!moved(start, oldStart) && !moved(end, oldEnd)) return { ...geometry, data: route.data, path: route.path };
  let parts = getEdgePathSegments(route.data);
  if (!parts.length) return { ...geometry, data: route.data, path: route.path };
  parts = adjustPreviewEndpoint(parts, start);
  parts = reversePreviewSegments(adjustPreviewEndpoint(reversePreviewSegments(parts), end));
  const path = [parts[0].start, ...parts.map(part => part.end)];
  const data = `M ${path[0].x} ${path[0].y} ` + parts.map(part =>
    `${part.controls.length === 2 ? "C" : part.controls.length === 1 ? "Q" : "L"} ${[...part.controls, part.end].map(point => `${point.x} ${point.y}`).join(" ")}`
  ).join(" ");
  return { ...geometry, data, path };
}
