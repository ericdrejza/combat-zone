import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { prepareValidatedEncounterChangeForRuntime } from "@core/validation/validatedEncounterChange";
import {
  createOrReplaceEdge,
  edgeMatchesPreset,
  getEdgeForSlot,
  type EdgePreset
} from "@entities/edge/edgeMutations";
import { selectEntity } from "@interaction/interactionState";
import { commitEncounterChange } from "@store/encounterSlice";
import { logEncounterValidationBlock } from "@store/encounterLogSlice";
import type { AppDispatch, RootState } from "@store/store";

export async function commitEdgeDrag(input: {
  dispatch: AppDispatch;
  encounter: RootState["encounter"]["present"];
  fromZoneId: string;
  preset: EdgePreset;
  toZoneId: string;
}) {
  const { dispatch, encounter, fromZoneId, preset, toZoneId } = input;
  if (fromZoneId === toZoneId) return;
  const occupied = getEdgeForSlot(encounter, fromZoneId, toZoneId, preset.directionality);
  if (occupied && edgeMatchesPreset(occupied, preset)) {
    dispatch(selectEntity({ entityType: "edge", ids: [occupied.id] }));
    return;
  }
  const edgeId = `edge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const result = createOrReplaceEdge(encounter, {
    ...preset,
    fromZoneId,
    id: edgeId,
    toZoneId
  });
  const prepared = await prepareValidatedEncounterChangeForRuntime({
    action: createEncounterActionRecord(occupied ? "edge.replace" : "edge.create", {
      edgeId,
      fromZoneId,
      replacedEdgeId: occupied?.id ?? null,
      toZoneId,
      ...preset
    }),
    currentEncounter: encounter,
    nextEncounter: result.nextEncounter
  });
  if (logEncounterValidationBlock(dispatch, prepared)) return;
  dispatch(commitEncounterChange({ action: prepared.action, nextEncounter: prepared.nextEncounter }));
  dispatch(selectEntity({ entityType: "edge", ids: [edgeId] }));
}
