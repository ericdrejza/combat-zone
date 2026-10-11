import type { LayoutPoint } from '@core/layout/types';
import { DEFAULT_ISOMETRIC_ANGLE, type GridConfiguration, type GridType } from './types';

type Projection = Pick<GridConfiguration, 'type' | 'isometricAngle'>;
export const isometricSlope = (grid: Projection) => grid.isometricAngle === undefined ? 0.5 : Math.tan(grid.isometricAngle * Math.PI / 180);
export const isometricAngle = (grid: Projection) => grid.isometricAngle ?? DEFAULT_ISOMETRIC_ANGLE;

/** Square and isometric share lattice addresses and four-edge connectivity. */
export const isSquareTopology = (type: GridType) => type === 'square' || type === 'isometric';
export const calibrationVertexCount = (type: GridType) => isSquareTopology(type) ? 4 : 3;

/** Project logical square coordinates without storing derived cell addresses. */
export function projectGridPoint(grid: Projection, point: LayoutPoint): LayoutPoint {
  return grid.type === 'isometric' ? { x: (point.x - point.y) / 2, y: (point.x + point.y) * isometricSlope(grid) / 2 } : point;
}
export function unprojectGridPoint(grid: Projection, point: LayoutPoint): LayoutPoint {
  return grid.type === 'isometric' ? { x: point.x + point.y / isometricSlope(grid), y: point.y / isometricSlope(grid) - point.x } : point;
}
