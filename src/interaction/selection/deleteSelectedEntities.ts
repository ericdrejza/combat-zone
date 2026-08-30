import type { Dispatch } from "redux";

import type { EncounterState } from "@core/encounter/types";
import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { deleteActor } from "@entities/actor/actorMutations";
import { deleteEdges } from "@entities/edge/edgeMutations";
import { deleteZone } from "@entities/zone/zoneMutations";
import { clearSelection } from "@interaction/interactionState";
import { commitEncounterChange } from "@store/encounterSlice";
import type { SelectionState } from "./types";

export type DeletableEntityType = "actor" | "edge" | "zone";

export function isDeletableEntityType(
  entityType: SelectionState["selectedEntityType"]
): entityType is DeletableEntityType {
  return entityType === "actor" || entityType === "edge" || entityType === "zone";
}

/** Commits the same history-aware deletion for keyboard and touch controls. */
export function deleteSelectedEntities(
  dispatch: Dispatch,
  encounter: EncounterState,
  selection: SelectionState
): boolean {
  const { selectedEntityType, selectedIds } = selection;
  if (!isDeletableEntityType(selectedEntityType) || selectedIds.length === 0) {
    return false;
  }

  const nextEncounter = selectedEntityType === "edge"
    ? deleteEdges(encounter, selectedIds)
    : selectedIds.reduce(
        (currentEncounter, entityId) => selectedEntityType === "actor"
          ? deleteActor(currentEncounter, entityId)
          : deleteZone(currentEncounter, entityId),
        encounter
      );

  dispatch(commitEncounterChange({
    action: createEncounterActionRecord(`${selectedEntityType}.delete`, {
      [`${selectedEntityType}Ids`]: selectedIds
    }),
    nextEncounter
  }));
  dispatch(clearSelection());
  return true;
}
