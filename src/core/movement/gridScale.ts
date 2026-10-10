import type { GridConfiguration } from './types';

export const GRID_SPACING = 64;
/** Geometry and calibration use physical spacing; persisted configuration uses map scale. */
export type GridGeometry = Omit<GridConfiguration, 'cellSize'> & { cellSize: number };

export function resolveGridGeometry(grid: GridConfiguration): GridGeometry {
  return { ...grid, cellSize: GRID_SPACING };
}
