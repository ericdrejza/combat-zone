import type { LayoutPoint } from './types';

/** Collapse zero-length edges, including the closing edge, without removing loops. */
export function mergeConsecutivePolygonPoints(polygon: LayoutPoint[]): LayoutPoint[] {
  const samePoint = (first: LayoutPoint, second: LayoutPoint) => Math.hypot(first.x - second.x, first.y - second.y) < 1e-6;
  const merged: LayoutPoint[] = [];
  for (const point of polygon) {
    if (!merged.length || !samePoint(merged[merged.length - 1], point)) merged.push(point);
  }
  if (merged.length > 1 && samePoint(merged[0], merged[merged.length - 1])) merged.pop();
  return merged;
}

/** Collinear samples subdivide an edge; only changes in direction are corners. */
export function getPolygonCornerIndices(polygon: LayoutPoint[]): number[] {
  return polygon.flatMap((point, index) => {
    const previous = polygon[(index + polygon.length - 1) % polygon.length];
    const next = polygon[(index + 1) % polygon.length];
    const dx = next.x - previous.x, dy = next.y - previous.y;
    const lengthSquared = dx * dx + dy * dy;
    const ratio = lengthSquared ? ((point.x - previous.x) * dx + (point.y - previous.y) * dy) / lengthSquared : 0;
    const distance = lengthSquared ? Math.abs((point.x - previous.x) * dy - (point.y - previous.y) * dx) / Math.sqrt(lengthSquared) : Infinity;
    return ratio > 0 && ratio < 1 && distance < 1e-6 ? [] : [index];
  });
}

/** Preserve each edge sample's fractional position when its endpoints move. */
export function remapPolygonCorners(polygon: LayoutPoint[], transform: (point: LayoutPoint) => LayoutPoint): LayoutPoint[] {
  const corners = getPolygonCornerIndices(polygon);
  if (corners.length < 3) return polygon.map(transform);
  const result = [...polygon];
  const mapped = corners.map(index => transform(polygon[index]));
  corners.forEach((startIndex, cornerIndex) => {
    const endIndex = corners[(cornerIndex + 1) % corners.length];
    const start = polygon[startIndex], end = polygon[endIndex];
    const first = mapped[cornerIndex], last = mapped[(cornerIndex + 1) % corners.length];
    result[startIndex] = first;
    const dx = end.x - start.x, dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    for (let index = (startIndex + 1) % polygon.length; index !== endIndex; index = (index + 1) % polygon.length) {
      const point = polygon[index];
      const ratio = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared;
      result[index] = { x: first.x + ratio * (last.x - first.x), y: first.y + ratio * (last.y - first.y) };
    }
  });
  return result;
}
