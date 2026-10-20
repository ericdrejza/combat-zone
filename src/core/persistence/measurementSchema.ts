import { validMeasurementSettings, validMovementAccounting } from '@core/measurement/types';
import type { EncounterState } from '@core/encounter/types';
import { PersistenceValidationError } from './types';

export function migrateMeasurementSettings(state: EncounterState): Omit<EncounterState, 'schemaVersion'> & { schemaVersion: 28 } {
  const { movement: _legacyMovement, ...tracker } = state.initiativeTracker;
  return { ...state, schemaVersion: 28,
    grid: { lineStyle: 'solid', distancePerCell: 5, distanceUnit: 'feet', ...state.grid },
    initiativeTracker: tracker };
}
export function assertMeasurementState(value: EncounterState, name: string) {
  if (!validMeasurementSettings(value.grid) || (value.initiativeTracker?.movement !== undefined && !validMovementAccounting(value.initiativeTracker.movement, value.actors.allIds)) ||
    Object.values(value.actors.byId).some(actor => actor.movementLimit !== undefined && (!Number.isFinite(actor.movementLimit) || actor.movementLimit < 0))) {
    throw new PersistenceValidationError(`${name}.measurement settings, actor limits or movement totals are invalid.`);
  }
}
