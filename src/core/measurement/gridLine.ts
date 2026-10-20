import type { LayoutPoint } from '@core/layout/types';
import type { GridConfiguration } from '@core/movement/types';
import { gridToWorld, snapToGrid, worldToGrid } from '@core/movement/gridGeometry';
import { resolveGridGeometry } from '@core/movement/gridScale';
import { isSquareTopology } from '@core/movement/gridProjection';

function roundCube(q: number, r: number) {
  let x = Math.round(q), z = Math.round(r); const y = Math.round(-q - r);
  if (Math.abs(x - q) > Math.abs(y + q + r) && Math.abs(x - q) > Math.abs(z - r)) x = -y - z;
  else if (Math.abs(z - r) > Math.abs(y + q + r)) z = -x - y;
  return { q: x, r: z };
}
/** A balanced digital line repeats the reduced slope's step sequence and reaches the selected endpoint exactly. */
export function gridLineCenters(config: GridConfiguration, start: LayoutPoint, end: LayoutPoint): LayoutPoint[] {
  const grid = resolveGridGeometry(config), s = grid.cellSize;
  const a = worldToGrid(grid, snapToGrid(grid, start, 'medium')), b = worldToGrid(grid, snapToGrid(grid, end, 'medium'));
  if (isSquareTopology(grid.type)) {
    const dx = Math.round((b.x - a.x) / s), dy = Math.round((b.y - a.y) / s), count = Math.max(Math.abs(dx), Math.abs(dy));
    if (!count) return [gridToWorld(grid, a)];
    return Array.from({ length: count + 1 }, (_, i) => gridToWorld(grid, {
      x: a.x + Math.sign(dx) * Math.floor((2 * i * Math.abs(dx) + count) / (2 * count)) * s,
      y: a.y + Math.sign(dy) * Math.floor((2 * i * Math.abs(dy) + count) / (2 * count)) * s
    }));
  }
  const axial = (p: LayoutPoint) => { const q = p.x / (s * Math.sqrt(3) / 2); return { q, r: p.y / s - q / 2 }; };
  const from = axial(a), to = axial(b), dq = to.q - from.q, dr = to.r - from.r;
  const count = Math.round(Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr)));
  return Array.from({ length: count + 1 }, (_, i) => {
    const t = count ? i / count : 0, p = roundCube(from.q + dq * t, from.r + dr * t);
    return gridToWorld(grid, { x: p.q * s * Math.sqrt(3) / 2, y: (p.r + p.q / 2) * s });
  });
}
