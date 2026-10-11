import type { LayoutPoint } from '@core/layout/types';
import type { GridConfiguration } from './types';
import { projectGridPoint } from './gridProjection';
import { calibratedRotation } from './gridRotation';

const logicalCorners = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
const mean = (points: LayoutPoint[]) => ({
  x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
  y: points.reduce((sum, p) => sum + p.y, 0) / points.length
});

/** Fit a rotated/scaled diamond at the configured projection angle, allowing every starting corner and winding. */
export function calibrateIsometricGrid(grid: GridConfiguration, points: LayoutPoint[]): GridConfiguration | null {
  if (points.length !== 4 || points.some(p => !Number.isFinite(p.x + p.y))) return null;
  const corners = logicalCorners.map(point => projectGridPoint(grid, point));
  const targetCenter = mean(points);
  let best: { error: number; scale: number; angle: number; origin: LayoutPoint } | null = null;
  for (const winding of [1, -1]) for (let start = 0; start < 4; start++) {
    const source = points.map((_, i) => corners[(start + winding * i + 8) % 4]);
    const center = mean(source);
    let dot = 0, cross = 0, denominator = 0;
    source.forEach((p, i) => {
      const x = p.x - center.x, y = p.y - center.y;
      const u = points[i].x - targetCenter.x, v = points[i].y - targetCenter.y;
      dot += x * u + y * v; cross += x * v - y * u; denominator += x * x + y * y;
    });
    const a = dot / denominator, b = cross / denominator;
    const scale = Math.hypot(a, b), angle = Math.atan2(b, a) * 180 / Math.PI;
    const origin = { x: targetCenter.x - a * center.x + b * center.y,
      y: targetCenter.y - b * center.x - a * center.y };
    const error = source.reduce((sum, p, i) => sum +
      (origin.x + a * p.x - b * p.y - points[i].x) ** 2 +
      (origin.y + b * p.x + a * p.y - points[i].y) ** 2, 0);
    if (!best || error < best.error) best = { error, scale, angle, origin };
  }
  if (!best || best.scale < 2 || points.some((p, i) => Math.hypot(p.x - points[(i + 1) % 4].x, p.y - points[(i + 1) % 4].y) < 1) ||
      Math.sqrt(best.error / 4) > best.scale * 0.15) return null;
  const { warp: _warp, ...standard } = grid;
  return { ...standard, origin: best.origin, cellSize: best.scale,
    rotation: calibratedRotation(best.angle, 'isometric'), visible: true };
}
