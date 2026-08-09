import type { EntityId } from "../state/entityCollection";
import { createEmptyEntityCollection } from "../state/entityCollection";
import type { EncounterState } from "./types";
import { ENCOUNTER_SCHEMA_VERSION } from "./types";
import { DEFAULT_CANVAS_SIZE } from "@core/layout/polygonCanvasBounds";

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
    backgroundImage: null,
    canvasSize: { ...DEFAULT_CANVAS_SIZE },
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
