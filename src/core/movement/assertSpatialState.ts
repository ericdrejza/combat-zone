import type { EncounterState } from '@core/encounter/types';
import { PersistenceValidationError } from '@core/persistence/types';
import { SpatialValidator } from './spatialValidator';
import { validGrid } from './types';

/** Import validation checks geometry before an encounter can reach Redux. */
export function assertSpatialState(value: Record<string, unknown>, name: string): void {
  if (!validGrid(value.grid) || !['zone', 'grid', 'free'].includes(String(value.movementStrategy))) {
    throw new PersistenceValidationError(`${name}.grid or movementStrategy is invalid.`);
  }
  const state = value as unknown as EncounterState;
  if (!state.actors?.byId || !state.canvasSize) return;
  for (const actor of Object.values(state.actors.byId)) {
    if (!actor || typeof actor !== "object") throw new PersistenceValidationError(`${name}.actor is invalid.`);
    if (actor.spatialPosition !== undefined && (!actor.spatialPosition || !Number.isFinite(actor.spatialPosition.x) || !Number.isFinite(actor.spatialPosition.y))) {
      throw new PersistenceValidationError(`${name}.actor spatialPosition must contain finite coordinates.`);
    }
    if (!['small', 'medium', 'large', 'xLarge'].includes(actor.size) && actor.spatialPosition) throw new PersistenceValidationError(`${name}.actor size is invalid.`);
  }
  const result = SpatialValidator.validate({ type: 'encounter.load', payload: {} }, { state, mode: 'OFF' });
  if (!result.valid) throw new PersistenceValidationError(result.messages[0].message);
}
