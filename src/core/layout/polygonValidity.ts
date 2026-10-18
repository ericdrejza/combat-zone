import type { LayoutPoint } from './types';

const validityByCoordinates = new Map<string, boolean>();

/** Rejects collapsed or self-intersecting outlines after snapping controls. */
export function isSimplePolygon(points: LayoutPoint[]): boolean {
  if (points.length < 3 || points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) return false;
  // Worker messages clone arrays. An exact coordinate key preserves completed
  // checks for unchanged Zones between requests, including rejected outlines.
  const key = JSON.stringify(points);
  let valid = validityByCoordinates.get(key);
  if (valid === undefined) {
    valid = calculateSimplePolygon(points);
    if (validityByCoordinates.size >= 1024) validityByCoordinates.delete(validityByCoordinates.keys().next().value!);
    validityByCoordinates.set(key, valid);
  }
  return valid;
}

function calculateSimplePolygon(points: LayoutPoint[]): boolean {
  const cross = (a: LayoutPoint, b: LayoutPoint, c: LayoutPoint) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const onSegment = (a: LayoutPoint, b: LayoutPoint, p: LayoutPoint) => Math.abs(cross(a, b, p)) < 1e-7 && p.x >= Math.min(a.x, b.x) - 1e-7 && p.x <= Math.max(a.x, b.x) + 1e-7 && p.y >= Math.min(a.y, b.y) - 1e-7 && p.y <= Math.max(a.y, b.y) + 1e-7;
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    if (Math.hypot(a.x - b.x, a.y - b.y) < 1e-7) return false;
    area += a.x * b.y - b.x * a.y;
    for (let j = i + 2; j < points.length; j++) {
      if (i === 0 && j === points.length - 1) continue;
      const c = points[j], d = points[(j + 1) % points.length];
      if ((cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0) || onSegment(a, b, c) || onSegment(a, b, d) || onSegment(c, d, a) || onSegment(c, d, b)) return false;
    }
  }
  return Math.abs(area) > 1e-7;
}
