import type { Middleware } from '@reduxjs/toolkit';
import type { EncounterHistoryState } from '@core/history/types';
import { isEncounterOperationActive } from '@core/history/encounterOperations';
import { reconcileInteractionReferences, selectEntity, setActiveTool, type InteractionState } from '@interaction/interactionState';
import { getAffectedHistoryEntities } from '@interaction/selection/historyAffectedEntities';
import { canToolSelectEntityType } from '@interaction/tools/toolRegistry';
import { readCanvasPreferences } from '@ui/canvas_preferences/canvasPreferenceStorage';
import { redoEncounterChange, undoEncounterChange } from './encounterSlice';

/** Reconcile session references, then optionally select surviving entities changed by history. */
export const historyInteractionMiddleware: Middleware<unknown, { encounter: EncounterHistoryState; interaction: InteractionState }> =
  (api) => (next) => (action) => {
    if (!undoEncounterChange.match(action) && !redoEncounterChange.match(action)) return next(action);
    if (isEncounterOperationActive()) return action;
    const history = api.getState().encounter;
    const entry = undoEncounterChange.match(action) ? history.past.at(-1) : history.future[0];
    const before = history.present;
    const result = next(action);
    const after = api.getState().encounter.present;
    if (after !== before) {
      api.dispatch(reconcileInteractionReferences(after));
      if (entry && readCanvasPreferences().selectOnUndoRedo) {
        const primaryType = entry.action.type.split(".")[0];
        const affected = getAffectedHistoryEntities(before, after).find(group => group.entityType === primaryType);
        if (affected) {
          const interaction = api.getState().interaction;
          const audioCannotSelect = interaction.activeToolId === "audio" && interaction.audioTool.sectionType !== affected.entityType;
          if (audioCannotSelect || !canToolSelectEntityType(interaction.activeToolId, affected.entityType)) {
            api.dispatch(setActiveTool("select"));
          }
          api.dispatch(selectEntity(affected));
        }
      }
    }
    return result;
  };
