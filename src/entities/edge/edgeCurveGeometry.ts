import type { LayoutPoint } from "@core/layout/types";
import type { EdgeRoutePreferences } from "./types";

export type EdgePathSegment = { start: LayoutPoint; end: LayoutPoint; controls: LayoutPoint[] };
export function getEdgePathSegments(data: string): EdgePathSegment[] {
  const result: EdgePathSegment[] = [];
  let start = { x: 0, y: 0 };
  let previous: LayoutPoint | undefined;
  for (const match of data.matchAll(/([MLQCT])\s*([^MLQCT]*)/g)) {
    const numbers = match[2].trim().split(/[\s,]+/).map(Number);
    const points: LayoutPoint[] = [];
    for (let index = 0; index < numbers.length; index += 2) points.push({ x: numbers[index], y: numbers[index + 1] });
    const end = points.at(-1)!;
    if (match[1] === "M") { start = end; previous = undefined; continue; }
    const controls = match[1] === "T" ? [{ x: 2 * start.x - (previous?.x ?? start.x), y: 2 * start.y - (previous?.y ?? start.y) }] : points.slice(0, -1);
    result.push({ start, end, controls });
    previous = controls.at(-1);
    start = end;
  }
  return result;
}
function frame(start: LayoutPoint, end: LayoutPoint) {
  const length = Math.hypot(end.x - start.x, end.y - start.y) || 1;
  return { x: -(end.y - start.y) / length, y: (end.x - start.x) / length };
}

/** Reuse numeric segments for curvature bounds instead of serializing/parsing every probe. */
export function adjustEdgePathSegments(parts: EdgePathSegment[], preferences: EdgeRoutePreferences): EdgePathSegment[] {
  const factor = (preferences.flipped ? -1 : 1) * preferences.curvature;
  return parts.map(({ start, end, controls }) => {
    const normal = frame(start, end);
    return { start, end, controls: controls.map(control => {
      const offset = (control.x - start.x) * normal.x + (control.y - start.y) * normal.y;
      return { x: control.x + normal.x * offset * (factor - 1), y: control.y + normal.y * offset * (factor - 1) };
    }) };
  });
}

/** Scale and reflect only control-point displacement; endpoints remain derived. */
export function adjustEdgeCurve(data: string, preferences?: EdgeRoutePreferences): string {
  if (!preferences || (!preferences.flipped && preferences.curvature === 1)) return data;
  const parts = getEdgePathSegments(data);
  if (!parts.length) return data;
  return `M ${parts[0].start.x} ${parts[0].start.y} ` + adjustEdgePathSegments(parts, preferences).map(({ end, controls }) =>
    `${controls.length === 2 ? "C" : controls.length === 1 ? "Q" : "L"} ${[...controls, end].map(point => `${point.x} ${point.y}`).join(" ")}`
  ).join(" ");
}

export type EdgeCurveHandle = { point: LayoutPoint; origin: LayoutPoint; normal: LayoutPoint; offset: number };

/** Extrema of normal displacement put handles on the curve's visible lobes. */
export function getEdgeCurveHandles(data: string): EdgeCurveHandle[] {
  return getEdgePathSegments(data).flatMap(({ start, end, controls }) => {
    if (!controls.length) return [];
    const normal = frame(start, end);
    const offsets = controls.map(control => (control.x - start.x) * normal.x + (control.y - start.y) * normal.y);
    let roots = [0.5];
    if (controls.length === 2) {
      const [a, b] = offsets;
      const quadratic = 3 * (a - b), linear = 2 * (b - 2 * a);
      const discriminant = linear * linear - 4 * quadratic * a;
      roots = Math.abs(quadratic) < 1e-9 ? (Math.abs(linear) < 1e-9 ? [] : [-a / linear])
        : discriminant < 0 ? [] : [(-linear + Math.sqrt(discriminant)) / (2 * quadratic), (-linear - Math.sqrt(discriminant)) / (2 * quadratic)];
    }
    return roots.filter(t => t > 0 && t < 1).map(t => {
      const u = 1 - t;
      const weights = controls.length === 1 ? [u * u, 2 * u * t, t * t] : [u ** 3, 3 * u * u * t, 3 * u * t * t, t ** 3];
      const points = [start, ...controls, end];
      const point = points.reduce((sum, p, i) => ({ x: sum.x + p.x * weights[i], y: sum.y + p.y * weights[i] }), { x: 0, y: 0 });
      const offset = (point.x - start.x) * normal.x + (point.y - start.y) * normal.y;
      return { point, origin: start, normal, offset };
    }).filter(handle => Math.abs(handle.offset) > 1e-6);
  });
}
