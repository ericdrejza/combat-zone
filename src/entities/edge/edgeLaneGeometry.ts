import type { LayoutPoint } from "@core/layout/types";
import { closestBoundaryPoint, distance } from "./edgeBoundaryGeometry";

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
