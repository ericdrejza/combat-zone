import type { LayoutPoint } from '@core/layout/types';
import type { ActorSize } from '@entities/actor/types';
import type { GridConfiguration } from '@core/movement/types';
import { gridToWorld, worldToGrid, nearbyAnchors, snapToGrid } from '@core/movement/gridGeometry';
import { resolveGridGeometry } from '@core/movement/gridScale';
import { isSquareTopology } from '@core/movement/gridProjection';
import type { DiagonalCost } from './types';

export type MeasuredRoute = { points: LayoutPoint[]; distance: number; diagonals: number };
const length = (a: LayoutPoint, b: LayoutPoint) => Math.hypot(a.x - b.x, a.y - b.y);

/** Routes are geometry-only; existing destination validation still owns movement legality. */
export function measureRoute(config: GridConfiguration, waypoints: LayoutPoint[], snapped: boolean,
  policy: DiagonalCost = 'one', priorDiagonals = 0, size: ActorSize = 'medium'): MeasuredRoute {
  const grid = resolveGridGeometry(config), unit = config.distancePerCell ?? 5;
  const points: LayoutPoint[] = [], cell = grid.cellSize;
  let distance = 0, diagonals = 0;
  const append = (point: LayoutPoint) => { if (!points.length || length(points[points.length - 1], point) > 1e-7) points.push(point); };
  for (let i = 0; i < waypoints.length; i++) {
    const end = snapped ? snapToGrid(grid, waypoints[i], size) : waypoints[i];
    if (!i) { append(end); continue; }
    let start = points[points.length - 1];
    if (!snapped) { distance += length(worldToGrid(grid, start), worldToGrid(grid, end)) / cell * unit; append(end); continue; }
    if (isSquareTopology(grid.type)) {
      let local = worldToGrid(grid, start); const target = worldToGrid(grid, end);
      const dx = Math.round((target.x - local.x) / cell), dy = Math.round((target.y - local.y) / cell);
      const diagonalSteps = policy === 'disabled' ? 0 : Math.min(Math.abs(dx), Math.abs(dy));
      const diagonalCost = policy === 'two' ? diagonalSteps * 2 : policy === 'alternating'
        ? Math.floor(diagonalSteps / 2) * 3 + (diagonalSteps % 2 ? 1 + (priorDiagonals + diagonals) % 2 : 0) : diagonalSteps;
      distance += (diagonalCost + Math.abs(dx) + Math.abs(dy) - 2 * diagonalSteps) * unit;
      diagonals += diagonalSteps;
      if (diagonalSteps) {
        local = { x: local.x + Math.sign(dx) * cell * diagonalSteps, y: local.y + Math.sign(dy) * cell * diagonalSteps };
        append(gridToWorld(grid, local));
      }
      for (const axis of ['x', 'y'] as const) {
        local = { ...local, [axis]: target[axis] }; append(gridToWorld(grid, local));
      }
    } else {
      // Hex center and vertex lattices have different neighbors. Use existing anchor geometry for both.
      for (let step = 0; step < 10000 && length(start, end) > 1e-5; step++) {
        const local = worldToGrid(grid, start), target = worldToGrid(grid, end);
        const candidates = nearbyAnchors(grid, start, size, 1).map(point => ({ point, local: worldToGrid(grid, point) }))
          .filter(candidate => length(candidate.local, local) > 1e-5);
        const shortest = Math.min(...candidates.map(candidate => length(candidate.local, local)));
        const next = candidates.filter(candidate => length(candidate.local, local) < shortest + 1e-5)
          .sort((a, b) => length(a.local, target) - length(b.local, target) || a.local.y - b.local.y || a.local.x - b.local.x)[0];
        if (!next || length(next.local, target) >= length(local, target) + 1e-5) break;
        start = next.point; append(start); distance += unit;
      }
    }
  }
  return { points, distance, diagonals };
}

/** Sample before projection so warped straight map lines render as their true curves. */
export function projectPolyline(config: GridConfiguration, localPoints: LayoutPoint[], close = false): LayoutPoint[] {
  const grid = resolveGridGeometry(config), result: LayoutPoint[] = [];
  for (let i = 0; i < localPoints.length - (close ? 0 : 1); i++) {
    const a = localPoints[i], b = localPoints[(i + 1) % localPoints.length];
    for (let j = 0; j < 8; j++) result.push(gridToWorld(grid, { x: a.x + (b.x - a.x) * j / 8, y: a.y + (b.y - a.y) * j / 8 }));
  }
  if (localPoints.length) result.push(gridToWorld(grid, close ? localPoints[0] : localPoints[localPoints.length - 1]));
  return result;
}
