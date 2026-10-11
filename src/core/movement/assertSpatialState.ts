import type { EncounterState } from '@core/encounter/types';
import { PersistenceValidationError } from '@core/persistence/types';
import { SpatialValidator } from './spatialValidator';
import { validGrid, validMovementRules } from './types';

/** Import validation checks geometry before an encounter can reach Redux. */
export function assertSpatialState(value: Record<string, unknown>, name: string): void {
  if (!validGrid(value.grid) || !validMovementRules(value.movementRules) || (value.schemaVersion !== 23 && value.schemaVersion !== 24 && value.schemaVersion !== 25 && value.grid.type === 'isometric') || ((value.schemaVersion !== 24 && value.schemaVersion !== 25) && value.grid.isometricAngle !== undefined)) {
    throw new PersistenceValidationError(`${name}.grid or movementRules is invalid.`);
  }
  const state = value as unknown as EncounterState;
  if (!state.actors?.byId || !state.canvasSize) return;
  for (const actor of Object.values(state.actors.byId)) {
    if (!actor || typeof actor !== "object") throw new PersistenceValidationError(`${name}.actor is invalid.`);
    if (actor.shape === 'transparent' && value.schemaVersion !== 25) throw new PersistenceValidationError(`${name}.actor Transparent shape requires schema 25.`);
    if (actor.spatialPosition !== undefined && (!actor.spatialPosition || !Number.isFinite(actor.spatialPosition.x) || !Number.isFinite(actor.spatialPosition.y))) {
      throw new PersistenceValidationError(`${name}.actor spatialPosition must contain finite coordinates.`);
    }
    if (!['small', 'medium', 'large', 'xLarge'].includes(actor.size) && actor.spatialPosition) throw new PersistenceValidationError(`${name}.actor size is invalid.`);
  }
  const result = SpatialValidator.validate({ type: 'encounter.load', payload: {} }, { state, mode: 'OFF' });
  if (!result.valid) throw new PersistenceValidationError(result.messages[0].message);
}
