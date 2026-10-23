import type { EncounterState } from "@core/encounter/types";

/** Absent mappings retain automatic health in slot one, without copying resource values. */
export function migrateResourceBars(state: Omit<EncounterState, "schemaVersion">): Omit<EncounterState, "schemaVersion"> & { schemaVersion: 30 } {
  return { ...state, schemaVersion: 30 };
}
