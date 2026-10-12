import { consumeEncounterPreparation } from "@core/history/encounterOperations";
import type { EncounterState } from '@core/encounter/types';
import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import { isSimplePolygon } from '@core/layout/polygonValidity';
import { zoneSnappingValid } from '@core/movement/zoneVertexSnapping';
import { prepareValidatedEncounterChangeForRuntime } from '@core/validation/runtimeEncounterChange';
import { updateZonePolygon } from '@entities/zone/zoneMutations';
import { selectEntity } from '@interaction/interactionState';
import { commitEncounterChange } from '@store/encounterSlice';
import { logEncounterValidationBlock, logEncounterValidationFailure } from '@store/encounterLogSlice';
import { isPersistenceWritable } from '@store/persistenceWriteGuardMiddleware';
import type { AppDispatch } from '@store/store';
import { canCommitZonePolygon } from './zoneGeometry';
import type { ZoneVertexEdit } from './zoneVertexEditing';

/** Vertex edits share the validated reshape workflow and one history entry. */
export function commitZoneVertexEdit(encounter: EncounterState, dispatch: AppDispatch, edit: ZoneVertexEdit): void {
  const { zone, polygon, kind, vertexIndex } = edit;
  if (!polygon || !isPersistenceWritable()) return;
  const valid = (state: EncounterState) => {
    const updated = state.zones.byId[zone.id];
    return !!updated && isSimplePolygon(updated.polygon) &&
      canCommitZonePolygon(updated.polygon, state.zones, zone.id, state.canvasSize) &&
      (!state.movementRules.snapZoneVertices || zoneSnappingValid(state, updated));
  };
  const nextEncounter = updateZonePolygon(encounter, zone.id, polygon);
  const action = createEncounterActionRecord('zone.reshape', { zoneId: zone.id, polygon, vertexEdit: kind, vertexIndex });
  const rejectGeometry = () => logEncounterValidationFailure(dispatch, encounter, {
    actionType: action.type, code: 'zone.invalidPolygonPlacement',
    message: 'A Zone vertex edit must keep a simple polygon within the canvas, without overlapping another Zone, and respect vertex snapping.',
    payload: action.payload
  });
  if (!valid(nextEncounter)) { rejectGeometry(); return; }
  const prepared = prepareValidatedEncounterChangeForRuntime({ currentEncounter: encounter, nextEncounter, action });
  const apply = (resolved: Awaited<typeof prepared>) => dispatch((_dispatch, getState) => {
    if (!isPersistenceWritable() || getState().encounter.present !== encounter) return;
    if (logEncounterValidationBlock(dispatch, resolved)) return;
    if (!valid(resolved.nextEncounter)) { rejectGeometry(); return; }
    dispatch(commitEncounterChange({ action: resolved.action, nextEncounter: resolved.nextEncounter }));
    dispatch(selectEntity({ entityType: 'zone', ids: [zone.id] }));
  });
  void consumeEncounterPreparation(prepared, apply);
}
