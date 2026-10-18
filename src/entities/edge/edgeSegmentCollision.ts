import { edgeObstacleQuery } from "./edgeObstacleIndex";
import { distanceToPolygonBoundary, distanceToSegment, getPolygonBounds, isPointInPolygon, segmentsIntersect } from "@core/layout/polygonGeometry";
import type { LayoutPoint } from "@core/layout/types";

/** Precompute bounds once per search; collision work depends on vertices, not span length. */
export function createEdgeSegmentChecker(polygons: LayoutPoint[][], clearance: number, boundaryPolygons: LayoutPoint[][] = []) {
  const margin = Math.max(0.25, clearance) - 0.01;
  const obstacles = edgeObstacleQuery(polygons);
  const boundaries = boundaryPolygons.map(polygon => ({ polygon, bounds: getPolygonBounds(polygon) }));
  return (a: LayoutPoint, b: LayoutPoint): boolean => {
    if (![a.x, a.y, b.x, b.y].every(Number.isFinite)) return false;
    const minX = Math.min(a.x, b.x) - margin, maxX = Math.max(a.x, b.x) + margin;
    const minY = Math.min(a.y, b.y) - margin, maxY = Math.max(a.y, b.y) + margin;
    const blocked = obstacles({ minX, maxX, minY, maxY }).some(polygon => {
      if (isPointInPolygon(a, polygon) || isPointInPolygon(b, polygon)) return true;
      return polygon.some((c, index) => {
        const d = polygon[(index + 1) % polygon.length];
        if (segmentsIntersect(a, b, c, d)) return true;
        const separation = Math.min(distanceToSegment(a, c, d), distanceToSegment(b, c, d), distanceToSegment(c, a, b), distanceToSegment(d, a, b));
        return separation < margin;
      });
    });
    if (blocked) return false;
    return !boundaries.some(({ polygon, bounds }) => {
      if (bounds.maxX < minX || bounds.minX > maxX || bounds.maxY < minY || bounds.minY > maxY) return false;
      if (polygon.some((c, index) => segmentsIntersect(a, b, c, polygon[(index + 1) % polygon.length]))) return true;
      const dx = b.x - a.x, dy = b.y - a.y, squared = dx * dx + dy * dy;
      const cuts = [0, 1, ...polygon.filter(point => distanceToSegment(point, a, b) < 1e-6).map(point => squared ? ((point.x - a.x) * dx + (point.y - a.y) * dy) / squared : 0)].sort((a, b) => a - b);
      const inside = (t: number) => {
        const point = { x: a.x + dx * t, y: a.y + dy * t };
        return isPointInPolygon(point, polygon) && distanceToPolygonBoundary(point, polygon) > 1e-6;
      };
      return cuts.some((t, index) => inside(t) || (index > 0 && inside((cuts[index - 1] + t) / 2)));
    });
  };
}
