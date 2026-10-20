import type { EncounterState } from '@core/encounter/types';
import type { LayoutPoint } from '@core/layout/types';
import { gridToWorld, worldToGrid, snapToGrid } from '@core/movement/gridGeometry';
import { resolveGridGeometry } from '@core/movement/gridScale';
import { isSquareTopology } from '@core/movement/gridProjection';

/** The clicked cell is authoritative; its outward boundary origin follows the target trajectory. */
export function coneGeometry(state: EncounterState, source: LayoutPoint, target: LayoutPoint) {
  const grid = resolveGridGeometry(state.grid);
  const center = worldToGrid(grid, state.movementRules.snapToGrid ? snapToGrid(grid, source, 'medium') : source);
  const end = worldToGrid(grid, target), angle = Math.atan2(end.y - center.y, end.x - center.x);
  if (!state.movementRules.snapToGrid) return { origin: source, direction: angle };
  const square = isSquareTopology(grid.type), interval = square ? Math.PI / 4 : Math.PI / 6;
  const step = Math.round(angle / interval), direction = step * interval;
  const corner = square ? Math.abs(step % 2) === 1 : step % 2 === 0;
  const radius = corner ? grid.cellSize / (square ? Math.SQRT2 : Math.sqrt(3)) : grid.cellSize / 2;
  return { origin: gridToWorld(grid, { x: center.x + Math.cos(direction) * radius, y: center.y + Math.sin(direction) * radius }), direction };
}
