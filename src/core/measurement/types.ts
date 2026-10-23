import type { LayoutPoint } from '@core/layout/types';

export type DiagonalCost = 'one' | 'alternating' | 'two' | 'disabled';
export type MovementPreferences = { diagonalCost: DiagonalCost; trackMovement: boolean; resetMovement: 'turn' | 'round' };
export const DEFAULT_MOVEMENT_PREFERENCES: MovementPreferences = { diagonalCost: 'one', trackMovement: false, resetMovement: 'turn' };
export type MovementTotal = { distance: number; diagonals: number };
/** Only authoritative accepted totals are durable; paths remain interaction drafts. */
export type MovementAccounting = Record<string, MovementTotal>;
export type RulerShape = 'line' | 'circle' | 'rectangle' | 'cone' | 'path';
export type RulerOptions = {
  shape: RulerShape;
  angle?: number;
  /** Omitted legacy flags use visible text and shape-dependent glow defaults. */
  showDistance?: boolean;
  highlightActors?: boolean;
};
export type LockedRuler = { id: string; points: LayoutPoint[]; options: RulerOptions; name: string; color: string | null; opacity: number | null };
export type RulerDraft = { points: LayoutPoint[]; complete: boolean };
export const DEFAULT_RULER_OPTIONS: RulerOptions = {
  shape: 'path'
};
export function validMeasurementSettings(grid: Record<string, unknown>): boolean {
  return ['solid', 'dashed', 'dotted', 'crosshair'].includes(String(grid.lineStyle)) &&
    Number.isSafeInteger(grid.distancePerCell) && (grid.distancePerCell as number) > 0 &&
    typeof grid.distanceUnit === 'string' && grid.distanceUnit.trim().length > 0;
}
export function validMovementAccounting(value: unknown, actorIds: string[]): value is MovementAccounting {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.entries(value).every(([id, total]) => actorIds.includes(id) && total && typeof total === 'object' &&
    Number.isFinite(total.distance) && total.distance >= 0 && Number.isSafeInteger(total.diagonals) && total.diagonals >= 0);
}
