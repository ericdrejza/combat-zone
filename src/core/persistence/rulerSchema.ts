import { validRulerCollection } from '@combat-zone/firebase-api';
import type { EncounterState } from '@core/encounter/types';
import { PersistenceValidationError } from './types';

export function migrateRulerArtifacts(state: Omit<EncounterState, 'schemaVersion'>): Omit<EncounterState, 'schemaVersion'> & { schemaVersion: 29 } {
  return { ...state, schemaVersion: 29, rulers: { byId: {}, allIds: [] } };
}
export function assertRulerState(value: unknown, name: string) {
  if (!validRulerCollection(value)) throw new PersistenceValidationError(`${name}.rulers contains invalid artifacts, points, colors, or collection IDs.`);
}
