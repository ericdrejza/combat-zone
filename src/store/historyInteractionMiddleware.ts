import type { Middleware } from '@reduxjs/toolkit';
import type { EncounterHistoryState } from '@core/history/types';
import { isEncounterOperationActive } from '@core/history/encounterOperations';
import { reconcileInteractionReferences } from '@interaction/interactionState';
import { redoEncounterChange, undoEncounterChange } from './encounterSlice';

/** History restores domain snapshots; session selection only retains valid references. */
export const historyInteractionMiddleware: Middleware<unknown, { encounter: EncounterHistoryState }> =
  (api) => (next) => (action) => {
    if (!undoEncounterChange.match(action) && !redoEncounterChange.match(action)) return next(action);
    if (isEncounterOperationActive()) return action;
    const before = api.getState().encounter.present;
    const result = next(action);
    const after = api.getState().encounter.present;
    if (after !== before) api.dispatch(reconcileInteractionReferences(after));
    return result;
  };
