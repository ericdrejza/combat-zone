import { placeSpatialActors } from '@core/movement/movementStrategies';
import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import { prepareValidatedEncounterChangeForRuntime } from '@core/validation/validatedEncounterChange';
import { commitEncounterChange } from '@store/encounterSlice';
import { isPersistenceWritable } from '@store/persistenceWriteGuardMiddleware';
import { logEncounterValidationBlock } from '@store/encounterLogSlice';
import { createSnapBackDrag } from './actorDragHelpers';
import type { MouseUpHandlerInput } from './mouseUpTypes';

export function handleSpatialActorMouseUp(input: MouseUpHandlerInput, remove = false): boolean {
  const { actorDrag, encounter, dispatch } = input;
  if (!actorDrag || encounter.movementStrategy === 'zone') return false;
  if (!actorDrag.hasMoved || !isPersistenceWritable()) { input.setActorDrag(null); return true; }
  const points = Object.fromEntries(actorDrag.actorIds.map(id => {
    const origin = actorDrag.originPointsByActorId?.[id] ?? encounter.actors.byId[id]?.spatialPosition ?? actorDrag.start;
    return [id, remove ? null : { x: origin.x + actorDrag.current.x - actorDrag.start.x, y: origin.y + actorDrag.current.y - actorDrag.start.y }];
  }));
  const next = placeSpatialActors(encounter, points);
  if (next === encounter) { input.setActorDrag(createSnapBackDrag(actorDrag)); return true; }
  const prepared = prepareValidatedEncounterChangeForRuntime({ currentEncounter: encounter, nextEncounter: next,
    action: createEncounterActionRecord('actor.moveSpatial', { actorIds: actorDrag.actorIds, removedFromCanvas: remove }) });
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
  if (prepared instanceof Promise) void prepared.then(apply); else apply(prepared);
  return true;
}
