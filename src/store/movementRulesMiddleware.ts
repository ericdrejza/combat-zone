import type { Middleware } from '@reduxjs/toolkit';
import { cancelGridEditing, setCellTracerActive, setActiveTool } from '@interaction/interactionState';
import type { EncounterState } from '@core/encounter/types';
import { SpatialValidator } from '@core/movement/spatialValidator';
import { commitEncounterChange } from './encounterSlice';
/** Defense in depth: direct commits cannot bypass structural movement constraints. */
export const movementRulesMiddleware: Middleware<{}, { encounter: { present: EncounterState }; interaction: { cellTracerActive: boolean } }> = api => next => action => {
  if (commitEncounterChange.match(action)) {
    const before = api.getState().encounter.present;
    const { nextEncounter, action: record } = action.payload;
    if (SpatialValidator.validate({ type: record.type, payload: record.payload }, { state: before, nextState: nextEncounter, mode: before.validationState.mode }).blocked) return;
  }
  const result = next(action);
  const current = api.getState().encounter.present;
  if (api.getState().interaction.cellTracerActive && (setActiveTool.match(action) && action.payload !== 'zone' || !current.movementRules.snapZoneVertices || !!current.grid.warp || (action as { type?: string }).type === 'encounter/loadEncounterState')) api.dispatch(setCellTracerActive(false));
  if ((action as { type?: string }).type === 'encounter/loadEncounterState') api.dispatch(cancelGridEditing());
  return result;
};
