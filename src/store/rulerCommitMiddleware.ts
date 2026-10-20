import type { Middleware } from '@reduxjs/toolkit';
import type { InteractionState } from '@interaction/interactionState';
import type { EncounterHistoryState } from '@core/history/types';
import type { LockedRuler } from '@core/measurement/types';
import { clearRulers, deleteLockedRuler, lockRulerDraft, editLockedRuler, updateLockedRuler } from '@interaction/rulerCommands';
import { removeRulerPoint, setEditingRuler, setRulerDraft } from '@interaction/interactionState';
import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import { saveRuler, deleteRuler, clearSavedRulers } from '@core/measurement/rulerMutations';
import { commitEncounterChange } from './encounterSlice';
import { isPersistenceWritable } from './persistenceWriteGuardMiddleware';

type State = { interaction: InteractionState; encounter: EncounterHistoryState };
/** Only completed lock/edit/delete commands cross the durable encounter and history boundary. */
export const rulerCommitMiddleware: Middleware<unknown, State> = api => next => action => {
  const { interaction, encounter: { present } } = api.getState();
  if (editLockedRuler.match(action)) {
    const ruler = present.rulers.byId[action.payload];
    if (ruler && isPersistenceWritable()) api.dispatch(setEditingRuler(ruler));
    return next(action);
  }
  const removingLast = removeRulerPoint.match(action) && action.payload.id && interaction.editingRuler?.id === action.payload.id && interaction.editingRuler.points.length === 1;
  if (!clearRulers.match(action) && !deleteLockedRuler.match(action) && !lockRulerDraft.match(action) && !updateLockedRuler.match(action) && !removingLast) return next(action);
  if (clearRulers.match(action) && !present.rulers.allIds.length) { api.dispatch(setRulerDraft(null)); return next(action); }
  if (!isPersistenceWritable()) return action;
  let changed = present, type = 'ruler.edit', ids: string[] = [], groupId: string | undefined;
  if (lockRulerDraft.match(action)) {
    const draft = interaction.editingRuler, points = action.payload.points ?? draft?.points ?? interaction.rulerDraft?.points;
    if (!points || points.length < 2) return action;
    const artifact: LockedRuler = draft ? { ...draft, points } : { id: action.payload.id, points, options: { ...interaction.rulerOptions }, name: '', color: null, opacity: null };
    type = draft ? 'ruler.edit' : 'ruler.create'; ids = [artifact.id]; changed = saveRuler(present, artifact);
  } else if (clearRulers.match(action)) { type = 'ruler.clear'; ids = present.rulers.allIds; changed = clearSavedRulers(present); }
  else if (deleteLockedRuler.match(action) || removingLast) {
    const id = deleteLockedRuler.match(action) ? action.payload : (action as ReturnType<typeof removeRulerPoint>).payload.id!;
    type = 'ruler.delete'; ids = [id]; changed = deleteRuler(present, id);
  } else if (updateLockedRuler.match(action)) {
    const { id, historyGroupId, ...patch } = action.payload, original = present.rulers.byId[id];
    if (!original) return action;
    groupId = historyGroupId; ids = [id]; type = patch.name !== undefined ? 'ruler.rename' : 'ruler.appearance';
    changed = saveRuler(present, { ...original, ...patch });
  }
  if (changed !== present) {
    const { validationResult: _unused, ...record } = createEncounterActionRecord(type, { rulerIds: ids, ...(groupId ? { groupId } : {}) });
    api.dispatch(commitEncounterChange({ action: record, nextEncounter: changed }));
  }
  if (lockRulerDraft.match(action) || clearRulers.match(action) || deleteLockedRuler.match(action) && interaction.editingRuler?.id === action.payload) api.dispatch(setRulerDraft(null));
  return next(action);
};
