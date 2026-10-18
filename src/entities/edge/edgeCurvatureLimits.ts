import { edgeGeometryKey } from "./edgeGeometryKey";
import { adjustEdgePathSegments, getEdgePathSegments, type EdgePathSegment } from "./edgeCurveGeometry";
import { distanceToSegment } from "@core/layout/polygonGeometry";
import type { LayoutPoint } from "@core/layout/types";

type Bounds = { minX: number; maxX: number; minY: number; maxY: number };
function roots(a: number, b: number, c: number): number[] {
  if (Math.abs(a) < 1e-12) return Math.abs(b) < 1e-12 ? [] : [-c / b];
  const discriminant = b * b - 4 * a * c;
  return discriminant < 0 ? [] : [(-b + Math.sqrt(discriminant)) / (2 * a), (-b - Math.sqrt(discriminant)) / (2 * a)];
}
function extent(segment: EdgePathSegment, axis: "x" | "y") {
  const p = [segment.start, ...segment.controls, segment.end].map(point => point[axis]);
  const candidates = p.length === 4 ? roots(-p[0] + 3 * p[1] - 3 * p[2] + p[3], 2 * (p[0] - 2 * p[1] + p[2]), p[1] - p[0])
    : p.length === 3 ? roots(0, p[0] - 2 * p[1] + p[2], p[1] - p[0]) : [];
  const values = [p[0], p.at(-1)!];
  for (const t of candidates.filter(value => value > 0 && value < 1)) {
    const u = 1 - t;
    values.push(p.length === 4 ? u ** 3 * p[0] + 3 * u * u * t * p[1] + 3 * u * t * t * p[2] + t ** 3 * p[3]
      : u * u * p[0] + 2 * u * t * p[1] + t * t * p[2]);
  }
  return { min: Math.min(...values), max: Math.max(...values) };
}
function within(parts: EdgePathSegment[], bounds: Bounds) {
  return parts.every(segment => {
    const x = extent(segment, "x"), y = extent(segment, "y");
    return x.min >= bounds.minX - 1e-7 && x.max <= bounds.maxX + 1e-7 && y.min >= bounds.minY - 1e-7 && y.max <= bounds.maxY + 1e-7;
  });
}

/** Exact Bézier extrema bound the complete curve, not just the diamond handles. */
function calculateMaximum(data: string, flipped: boolean, polygons?: LayoutPoint[][]): number | undefined {
  const parts = getEdgePathSegments(data);
  if (!parts.length) return 0;
  const start = parts[0].start, end = parts.at(-1)!.end;
  const bounds = { minX: Math.min(start.x, end.x), maxX: Math.max(start.x, end.x), minY: Math.min(start.y, end.y), maxY: Math.max(start.y, end.y) };
  const sides = [start, end].map((point, index) => {
    const polygon = polygons?.[index] ?? [];
    return polygon.map((a, i) => [a, polygon[(i + 1) % polygon.length]]).filter(([a, b]) => distanceToSegment(point, a, b) < 1e-5);
  });
  // Parallel attachment sides provide their full span even when ports align.
  for (const [a, b] of sides[0]) for (const [c, d] of sides[1]) {
    const ux = b.x - a.x, uy = b.y - a.y, vx = d.x - c.x, vy = d.y - c.y;
    if (Math.hypot(ux, uy) * Math.hypot(vx, vy) < 1e-8 || Math.abs(ux * vy - uy * vx) > 1e-7 * Math.hypot(ux, uy) * Math.hypot(vx, vy)) continue;
    for (const point of [a, b, c, d]) {
      bounds.minX = Math.min(bounds.minX, point.x); bounds.maxX = Math.max(bounds.maxX, point.x);
      bounds.minY = Math.min(bounds.minY, point.y); bounds.maxY = Math.max(bounds.maxY, point.y);
    }
  }
  const allowed = (curvature: number) => within(adjustEdgePathSegments(parts, { flipped, curvature }), bounds);
  if (!allowed(0)) return undefined;
  if (bounds.maxX - bounds.minX < 1e-7 || bounds.maxY - bounds.minY < 1e-7) return 0;
  let low = 0, high = 1;
  while (allowed(high) && high < 1e6) { low = high; high *= 2; }
  if (high >= 1e6 && allowed(high)) return 0;
  for (let iteration = 0; iteration < 44; iteration++) {
    const middle = (low + high) / 2;
    if (allowed(middle)) low = middle;
    else high = middle;
  }
  return low;
}

// Pointer movement reuses the same baseline; keep this derived calculation bounded.
const cache = new Map<string, number | undefined>();
export function getEdgeCurvatureMaximum(data: string, flipped: boolean, polygons?: LayoutPoint[][]): number | undefined {
  const key = `${flipped}:${data}:${JSON.stringify(edgeGeometryKey(polygons ?? []))}`;
  if (cache.has(key)) return cache.get(key);
  const maximum = calculateMaximum(data, flipped, polygons);
  if (cache.size >= 128) cache.delete(cache.keys().next().value!);
  cache.set(key, maximum);
  return maximum;
}
