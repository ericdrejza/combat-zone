import { getPolygonBounds } from "@core/layout/polygonGeometry";
import type { LayoutPoint } from "@core/layout/types";
import type { EdgePathSegment } from "./edgeCurveGeometry";
import type { PathSpace } from "./edgePathCollision";

const cachedBounds = new WeakMap<LayoutPoint[], ReturnType<typeof getPolygonBounds>>();
const cachedAxes = new WeakMap<LayoutPoint[], { x: number; y: number; min: number; max: number }[]>();
function axesFor(polygon: LayoutPoint[]) {
  let axes = cachedAxes.get(polygon);
  if (axes) return axes;
  const directions = [{ x: 1, y: 0 }, { x: 0, y: 1 }];
  polygon.forEach((a, index) => {
    const b = polygon[(index + 1) % polygon.length];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length) directions.push({ x: -(b.y - a.y) / length, y: (b.x - a.x) / length });
  });
  axes = directions.map(axis => {
    const values = polygon.map(point => point.x * axis.x + point.y * axis.y);
    return { ...axis, min: Math.min(...values), max: Math.max(...values) };
  });
  cachedAxes.set(polygon, axes);
  return axes;
}

function separated(points: LayoutPoint[], polygon: LayoutPoint[], margin: number): boolean {
  let bounds = cachedBounds.get(polygon);
  if (!bounds) { bounds = getPolygonBounds(polygon); cachedBounds.set(polygon, bounds); }
  const minX = Math.min(...points.map(p => p.x)), maxX = Math.max(...points.map(p => p.x));
  const minY = Math.min(...points.map(p => p.y)), maxY = Math.max(...points.map(p => p.y));
  if (minX >= bounds.maxX + margin || maxX <= bounds.minX - margin || minY >= bounds.maxY + margin || maxY <= bounds.minY - margin) return true;
  return axesFor(polygon).some(axis => {
    const curve = points.map(point => point.x * axis.x + point.y * axis.y);
    return Math.min(...curve) >= axis.max + margin || Math.max(...curve) <= axis.min - margin;
  });
}

/** A Bézier lies inside its control hull: separation proves safety without length-based sampling. */
export function areEdgeControlHullsClear(parts: EdgePathSegment[], space: PathSpace): boolean {
  const { bounds } = space;
  return parts.every(segment => {
    const points = [segment.start, ...segment.controls, segment.end];
    if (!points.every(point => Number.isFinite(point.x) && Number.isFinite(point.y) && point.x >= bounds.x && point.x <= bounds.x + bounds.width && point.y >= bounds.y && point.y <= bounds.y + bounds.height)) return false;
    return space.polygons.every(polygon => separated(points, polygon,
      space.obstaclePolygons.includes(polygon) ? Math.max(0.25, space.clearance) - 0.01 : 0));
  });
}
