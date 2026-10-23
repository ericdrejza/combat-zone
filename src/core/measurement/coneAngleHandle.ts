import type { EncounterState } from '@core/encounter/types';
import type { LayoutPoint } from '@core/layout/types';
import { gridToWorld, worldToGrid } from '@core/movement/gridGeometry';
import { resolveGridGeometry } from '@core/movement/gridScale';
import { isSquareTopology } from '@core/movement/gridProjection';
import { coneGeometry } from './coneGeometry';
import type { RulerOptions } from './types';

export type ConeAngleHandleGeometry = { point: LayoutPoint; origin: LayoutPoint; direction: number; angle: number };

/** The left arc corner is derived from the same unprojected geometry as the cone outline. */
export function coneAngleHandle(encounter: EncounterState, points: LayoutPoint[], options: RulerOptions): ConeAngleHandleGeometry | null {
  if (options.shape !== 'cone' || points.length < 2) return null;
  const grid = resolveGridGeometry(encounter.grid), end = points.at(-1)!;
  const cone = coneGeometry(encounter, points[0], end), origin = worldToGrid(grid, cone.origin), target = worldToGrid(grid, end);
  const rawRadius = Math.hypot(target.x - origin.x, target.y - origin.y);
  const radius = encounter.movementRules.snapToGrid ? Math.round(rawRadius / grid.cellSize) * grid.cellSize : rawRadius;
  if (radius < 1e-6) return null;
  const angle = options.angle ?? (isSquareTopology(grid.type) ? 90 : 60), edge = cone.direction - angle * Math.PI / 360;
  return { origin, direction: cone.direction, angle, point: gridToWorld(grid, { x: origin.x + radius * Math.cos(edge), y: origin.y + radius * Math.sin(edge) }) };
}

/** Angular movement changes aperture symmetrically without moving the origin or range endpoint. */
export function draggedConeAngle(encounter: EncounterState, geometry: ConeAngleHandleGeometry, anchor: LayoutPoint, pointer: LayoutPoint): number {
  const grid = resolveGridGeometry(encounter.grid), start = worldToGrid(grid, anchor), end = worldToGrid(grid, pointer), origin = geometry.origin;
  if (Math.hypot(end.x - origin.x, end.y - origin.y) < 1e-6) return geometry.angle;
  const initial = Math.atan2(start.y - origin.y, start.x - origin.x), current = Math.atan2(end.y - origin.y, end.x - origin.x);
  const delta = Math.atan2(Math.sin(current - initial), Math.cos(current - initial));
  return Math.max(1, Math.min(180, Math.round(geometry.angle - delta * 360 / Math.PI)));
}
