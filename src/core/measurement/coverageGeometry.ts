import type { LayoutPoint } from '@core/layout/types';

const cross = (a: LayoutPoint, b: LayoutPoint) => a.x * b.y - a.y * b.x;
export const polygonArea = (points: LayoutPoint[]) => Math.abs(points.reduce((sum, a, i) => sum + cross(a, points[(i + 1) % points.length]), 0)) / 2;

/** Clip a convex cell against a linear boundary; positive signed distance is inside. */
export function clipHalfPlane(points: LayoutPoint[], distance: (point: LayoutPoint) => number): LayoutPoint[] {
  const result: LayoutPoint[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length], da = distance(a), db = distance(b);
    if (da >= 0) result.push(a);
    if ((da >= 0) !== (db >= 0)) {
      const t = da / (da - db);
      result.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return result;
}

export function clipToConvexPolygon(cell: LayoutPoint[], shape: LayoutPoint[]): LayoutPoint[] {
  const signed = shape.reduce((sum, a, i) => sum + cross(a, shape[(i + 1) % shape.length]), 0);
  if (Math.abs(signed) < 1e-12) return [];
  for (let i = 0; i < shape.length && cell.length; i++) {
    const a = shape[i], b = shape[(i + 1) % shape.length], sign = Math.sign(signed);
    cell = clipHalfPlane(cell, p => sign * ((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)));
  }
  return cell;
}

/** Exact circle/cell intersection: split edges at circle crossings, then sum triangles and sectors.
 * This keeps the 50% decision independent of the rendered arc's tessellation.
 */
export function circleIntersectionArea(cell: LayoutPoint[], origin: LayoutPoint, radius: number): number {
  const r2 = radius * radius;
  const points = cell.map(p => ({ x: p.x - origin.x, y: p.y - origin.y }));
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length], dx = b.x - a.x, dy = b.y - a.y;
    const aa = dx * dx + dy * dy;
    if (aa < 1e-20) continue;
    const bb = 2 * (a.x * dx + a.y * dy), cc = a.x * a.x + a.y * a.y - r2;
    const discriminant = bb * bb - 4 * aa * cc, cuts = [0, 1];
    if (discriminant > 0) {
      const root = Math.sqrt(discriminant);
      for (const t of [(-bb - root) / (2 * aa), (-bb + root) / (2 * aa)]) if (t > 0 && t < 1) cuts.push(t);
    }
    cuts.sort((x, y) => x - y);
    for (let j = 1; j < cuts.length; j++) {
      const at = (t: number) => ({ x: a.x + dx * t, y: a.y + dy * t });
      const p = at(cuts[j - 1]), q = at(cuts[j]), mid = at((cuts[j - 1] + cuts[j]) / 2);
      area += mid.x * mid.x + mid.y * mid.y < r2
        ? cross(p, q) / 2 : r2 * Math.atan2(cross(p, q), p.x * q.x + p.y * q.y) / 2;
    }
  }
  return Math.abs(area);
}
