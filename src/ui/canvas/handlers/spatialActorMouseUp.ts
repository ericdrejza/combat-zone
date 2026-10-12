import { consumeEncounterPreparation } from "@core/history/encounterOperations";
import { placeSpatialActors } from '@core/movement/movementStrategies';
import { adjustedSpatialActorIds } from '@core/movement/spatialAdjustment';
import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import { prepareValidatedEncounterChangeForRuntime } from '@core/validation/runtimeEncounterChange';
import { commitEncounterChange } from '@store/encounterSlice';
import { createCommittedEncounterLogEntry } from '@core/logging/formatEncounterLogEntry';
import { isPersistenceWritable } from '@store/persistenceWriteGuardMiddleware';
import { appendEncounterLogEntry, logEncounterValidationBlock, logEncounterValidationFailure } from '@store/encounterLogSlice';
import { createSnapBackDrag } from './actorDragHelpers';
import type { MouseUpHandlerInput } from './mouseUpTypes';

export function handleSpatialActorMouseUp(input: MouseUpHandlerInput, remove = false): boolean {
  const { actorDrag, encounter, dispatch } = input;
  if (!actorDrag || encounter.movementRules.zoneLocked) return false;
  if (!actorDrag.hasMoved || !isPersistenceWritable()) { input.setActorDrag(null); return true; }
  const points = Object.fromEntries(actorDrag.actorIds.map(id => {
    const origin = actorDrag.originPointsByActorId?.[id] ?? encounter.actors.byId[id]?.spatialPosition ?? actorDrag.start;
    return [id, remove ? null : { x: origin.x + actorDrag.current.x - actorDrag.start.x, y: origin.y + actorDrag.current.y - actorDrag.start.y }];
  }));
  const next = placeSpatialActors(encounter, points);
  if (next === encounter) {
    if (actorDrag.actorIds.length === 1 && encounter.actors.byId[actorDrag.actorIds[0]]?.spatialPosition) {
      if (adjustedSpatialActorIds(encounter, points).length) {
        const action = createEncounterActionRecord('actor.moveSpatial', { actorIds: actorDrag.actorIds, adjustedActorIds: actorDrag.actorIds });
        dispatch(appendEncounterLogEntry(createCommittedEncounterLogEntry(action, { before: encounter, after: encounter })));
      }
    } else logEncounterValidationFailure(dispatch, encounter, { actionType: 'actor.moveSpatial', code: 'movement.noOpenAnchor', message: 'No fitting open grid anchor is available.', payload: { actorIds: actorDrag.actorIds } });
    input.setActorDrag(createSnapBackDrag(actorDrag)); return true;
  }
  const prepared = prepareValidatedEncounterChangeForRuntime({ currentEncounter: encounter, nextEncounter: next,
    action: createEncounterActionRecord('actor.moveSpatial', { actorIds: actorDrag.actorIds, removedFromCanvas: remove, requestedPositions: points }) });
  const apply = (resolved: Awaited<typeof prepared>) => {
    dispatch((_dispatch, getState) => {
    if (getState().encounter.present !== encounter) { input.setActorDrag(null); return; }
    if (logEncounterValidationBlock(dispatch, resolved) || !isPersistenceWritable()) input.setActorDrag(createSnapBackDrag(actorDrag));
    else {
      dispatch(commitEncounterChange({ action: resolved.action, nextEncounter: resolved.nextEncounter }));
      input.setActorDrag(remove ? null : { ...actorDrag, phase: 'returning', returnPointsByActorId: undefined });
    }
    });
  };
  void consumeEncounterPreparation(prepared, apply, () => input.setActorDrag(null));
  return true;
}
