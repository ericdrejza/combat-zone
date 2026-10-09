import type { Middleware } from '@reduxjs/toolkit';
import { cancelGridEditing, clearSelection, setActiveTool } from '@interaction/interactionState';
import type { ToolId } from '@interaction/tools/toolRegistry';
import type { EncounterState } from '@core/encounter/types';
import { SpatialValidator } from '@core/movement/spatialValidator';
import { commitEncounterChange } from './encounterSlice';

type MovementStore = { encounter: { present: EncounterState }; interaction: { activeToolId: ToolId } };
/** Hidden editing workflows cannot be reached through shortcuts or direct commits. */
export const movementStrategyMiddleware: Middleware<{}, MovementStore> = api => next => action => {
  const before = api.getState().encounter.present;
  if (setActiveTool.match(action)) {
    if (action.payload === 'edge' && before.movementStrategy !== 'zone') return;
    if (['zone', 'grid', 'free'].includes(action.payload)) {
      return next(setActiveTool(before.movementStrategy));
    }
  }
  if (commitEncounterChange.match(action)) {
    const { nextEncounter, action: record } = action.payload;
    if (before.movementStrategy !== 'zone' && /^(zone|edge|engagement)\./.test(record.type)) return;
    if (SpatialValidator.validate({ type: record.type, payload: record.payload }, { state: before, nextState: nextEncounter, mode: before.validationState.mode }).blocked) return;
  }
  const result = next(action);
  const after = api.getState().encounter.present;
  if (after.movementStrategy !== before.movementStrategy) {
    api.dispatch(clearSelection());
    api.dispatch(setActiveTool(after.movementStrategy));
  }
  if ((action as { type?: string }).type === 'encounter/loadEncounterState') api.dispatch(cancelGridEditing());
  return result;
};
