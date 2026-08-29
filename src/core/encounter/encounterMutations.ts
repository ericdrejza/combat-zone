import type { EncounterState } from "./types";

/** Renames the encounter without changing any entity or layout state. */
export function renameEncounter(
  encounter: EncounterState,
  name: string
): EncounterState {
  const trimmedName = name.trim();

  if (!trimmedName || trimmedName === encounter.name) {
    return encounter;
  }

  return {
    ...encounter,
    name: trimmedName
  };
}
