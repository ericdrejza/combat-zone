import { DEFAULT_MOVEMENT_RULES } from '@core/movement/types';
import { changeMovementRules } from '@core/movement/changeMovementRules';
import type { EncounterState } from '@core/encounter/types';
import type { LayoutPoint } from '@core/layout/types';
export function movementRulesFor(strategy: string) {
  return { ...DEFAULT_MOVEMENT_RULES, zoneLocked: strategy === 'zone', snapToGrid: strategy === 'grid', allowOverlap: strategy !== 'zone' };
}
export function setTestMovement(state: EncounterState, strategy: string, points: Record<string, LayoutPoint>) {
  return changeMovementRules(state, movementRulesFor(strategy), points);
}
