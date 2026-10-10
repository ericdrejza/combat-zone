import type { Actor } from '@entities/actor/types';
import type { GridConfiguration } from './types';
import type { LayoutPoint } from '@core/layout/types';
import { worldToGrid } from './gridGeometry';
import { warpDerivative } from './gridWarp';

/** Only legacy document validation uses the pre-schema-21 token footprint. */
export function legacyActorRadius(actor: Actor, grid: GridConfiguration, point: LayoutPoint) {
  const dimensions = { small: 0.6, medium: 0.9, large: 1.8, xLarge: 2.7 };
  let scale = 1;
  if (grid.warp) {
    const local = worldToGrid(grid, point);
    const { a, b, c, d, determinant } = warpDerivative(grid.warp,
      { x: local.x / grid.cellSize, y: local.y / grid.cellSize });
    const sum = a * a + b * b + c * c + d * d;
    scale = Math.sqrt(Math.max(0, (sum - Math.sqrt(Math.max(0, sum * sum - 4 * determinant * determinant))) / 2));
  }
  return grid.cellSize * dimensions[actor.size] * scale / 2;
}
