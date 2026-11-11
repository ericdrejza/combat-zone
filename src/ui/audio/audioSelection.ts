import type { EncounterState } from "@core/encounter/types";
import type { SelectionState } from "@interaction/selection/types";

/** Resolve the union from authoritative assignments, including selected Zones' occupants. */
export function getSelectedAudioGroupIds(encounter: EncounterState, selection: SelectionState): Set<string> {
  const ids = new Set<string>();
  const add = (groupIds: string[] = []) => {
    for (const id of groupIds) if (encounter.audioCueGroups.byId[id]) ids.add(id);
  };
  if (selection.selectedEntityType === "actor") {
    for (const id of selection.selectedIds) add(encounter.actors.byId[id]?.audioGroupIds);
  } else if (selection.selectedEntityType === "zone") {
    const zones = new Set(selection.selectedIds);
    for (const id of zones) add(encounter.zones.byId[id]?.audioGroupIds);
    for (const id of encounter.actors.allIds) {
      const actor = encounter.actors.byId[id];
      if (zones.has(actor.currentZoneId)) add(actor.audioGroupIds);
    }
  }
  return ids;
}
