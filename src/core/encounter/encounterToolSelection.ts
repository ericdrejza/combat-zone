import type { EncounterState } from "./types";

export type EncounterLoadTool = "select" | "zone" | "actor";

/** Selects the first useful editing tool for an encounter that has just loaded. */
export function getEncounterLoadTool(encounter: EncounterState): EncounterLoadTool {
  const zoneCount = encounter.zones.allIds.length;
  const actorCount = encounter.actors.allIds.length;

  if (zoneCount <= 1) {
    return "zone";
  }

  if (actorCount <= 1) {
    return "actor";
  }

  return "select";
}
