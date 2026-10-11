import type { EncounterState } from '@core/encounter/types';
import { adjustedSpatialActorIds } from '@core/movement/spatialAdjustment';
import { reconcileZoneVertices } from '@core/movement/zoneVertexSnapping';
import { reconcileMembership } from '@core/movement/reconcileMembership';
import {
  prepareValidatedEncounterChange,
  prepareValidatedEncounterChangeAsync,
  type PrepareValidatedEncounterChangeInput,
  type PreparedValidatedEncounterChange
} from './validatedEncounterChange';

/** Resolves browser membership preferences before sending pure state to validation. */
export function prepareValidatedEncounterChangeForRuntime(
  input: PrepareValidatedEncounterChangeInput
): PreparedValidatedEncounterChange | Promise<PreparedValidatedEncounterChange> {
  const adjustedActorIds = adjustedSpatialActorIds(input.nextEncounter, input.action.payload.requestedPositions);
  if (adjustedActorIds.length) input = { ...input, action: { ...input.action, payload: { ...input.action.payload, adjustedActorIds } } };
  const next = reconcileMembership(input.currentEncounter, reconcileZoneVertices(input.nextEncounter), input.action);
  const prepare = (nextEncounter: EncounterState | null) => {
    if (!nextEncounter) return { blocked: true, action: input.action, nextEncounter: input.currentEncounter, requiresConfirmation: false,
      validationResult: { valid: false, blocked: true, mode: input.currentEncounter.validationState.mode, messages: [] } } as PreparedValidatedEncounterChange;
    const resolved = { ...input, nextEncounter };
    return typeof Worker === 'undefined' ? prepareValidatedEncounterChange(resolved) : prepareValidatedEncounterChangeAsync(resolved);
  };
  return next instanceof Promise ? next.then(prepare) : prepare(next);
}
