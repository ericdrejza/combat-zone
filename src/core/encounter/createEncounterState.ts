import type { EntityId } from "../state/entityCollection";
import { createEmptyEntityCollection } from "../state/entityCollection";
import type { EncounterState } from "./types";
import { ENCOUNTER_SCHEMA_VERSION } from "./types";

export type CreateEncounterStateInput = {
  id: EntityId;
  name: string;
};

export function createEncounterState({
  id,
  name
}: CreateEncounterStateInput): EncounterState {
  return {
    schemaVersion: ENCOUNTER_SCHEMA_VERSION,
    id,
    name,
    zones: createEmptyEntityCollection(),
    edges: createEmptyEntityCollection(),
    actors: createEmptyEntityCollection(),
    engagements: createEmptyEntityCollection(),
    annotations: createEmptyEntityCollection(),
    initiativeTracker: {
      actorIds: [],
      currentActorId: null
    },
    validationState: {
      mode: "ADVISORY",
      messages: []
    }
  };
}
