import type { RulerShape } from './types';
import type { LayoutPoint } from '@core/layout/types';
import { circleIntersectionArea, clipHalfPlane, clipToConvexPolygon, polygonArea } from './coverageGeometry';

export type RulerCellCoverage = 'corners-or-center' | 'center' | 'majority' | 'corners-and-origin' | 'corners-and-adjacent';
export const RULER_CELL_COVERAGE_CHOICES: RulerCellCoverage[] = ['corners-or-center', 'center', 'majority', 'corners-and-origin', 'corners-and-adjacent'];
export type AreaCoverageShape = {
  shape: RulerShape; origin: LayoutPoint; radius: number;
  direction: number; halfAngle: number; polygon: LayoutPoint[];
};

export function coveredArea(cell: LayoutPoint[], shape: AreaCoverageShape): number {
  if (shape.shape !== 'circle' && shape.shape !== 'cone') return polygonArea(clipToConvexPolygon(cell, shape.polygon));
  if (shape.shape === 'cone') {
    const { origin, direction, halfAngle } = shape;
    const lower = direction - halfAngle, upper = direction + halfAngle;
    cell = clipHalfPlane(cell, p => Math.cos(lower) * (p.y - origin.y) - Math.sin(lower) * (p.x - origin.x));
    cell = clipHalfPlane(cell, p => Math.sin(upper) * (p.x - origin.x) - Math.cos(upper) * (p.y - origin.y));
  }
  return circleIntersectionArea(cell, shape.origin, shape.radius);
}

/** A neighboring cone cell must touch the origin and contain actual effect area, not just a boundary. */
export function touchesConeOrigin(vertices: LayoutPoint[], shape: AreaCoverageShape): boolean {
  if (shape.shape !== 'cone') return false;
  const point = shape.origin;
  const touches = vertices.every((a, i) => {
    const b = vertices[(i + 1) % vertices.length];
    return (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x) >= -1e-5;
  });
  return touches && coveredArea(vertices, shape) > polygonArea(vertices) * 1e-10;
}

/** Corner rules count true lattice vertices, never samples from a projected cell edge. */
export function cellIsCovered(vertices: LayoutPoint[], center: LayoutPoint, inside: (point: LayoutPoint) => boolean,
  rule: RulerCellCoverage, shape: AreaCoverageShape, originCell = false): boolean {
  if (rule === 'center') return inside(center);
  if (rule === 'majority') {
    const area = polygonArea(vertices);
    return area > 0 && coveredArea(vertices, shape) > area / 2 + area * 1e-10;
  }
  const threshold = vertices.length === 6 ? 4 : 3;
  let covered = 0;
  for (const vertex of vertices) if (inside(vertex) && ++covered >= threshold) return true;
  return rule === 'corners-or-center' ? inside(center) : originCell;
}
