import { createDefaultGrid } from '@core/movement/types';
import type { EntityId } from "../state/entityCollection";
import { createEmptyEntityCollection } from "../state/entityCollection";
import type { EncounterState } from "./types";
import { ENCOUNTER_SCHEMA_VERSION } from "./types";
import { DEFAULT_CANVAS_SIZE } from "@core/layout/polygonCanvasBounds";
import {
  createPanelLayoutFromOrder,
  DEFAULT_ENCOUNTER_PANEL_ORDER,
  type EncounterPanelOrder
} from "./panelLayout";

export type CreateEncounterStateInput = {
  id: EntityId;
  name: string;
  panelOrder?: EncounterPanelOrder;
};

export function createEncounterState({
  id,
  name,
  panelOrder = DEFAULT_ENCOUNTER_PANEL_ORDER
}: CreateEncounterStateInput): EncounterState {
  return {
    movementStrategy: 'zone',
    grid: createDefaultGrid(),
    schemaVersion: ENCOUNTER_SCHEMA_VERSION,
    id,
    name,
    counters: createEmptyEntityCollection(),
    clocks: createEmptyEntityCollection(),
    backgroundImage: null,
    canvasSize: { ...DEFAULT_CANVAS_SIZE },
    zones: createEmptyEntityCollection(),
    edges: createEmptyEntityCollection(),
    actors: createEmptyEntityCollection(),
    engagements: createEmptyEntityCollection(),
    annotations: createEmptyEntityCollection(),
    audioCues: createEmptyEntityCollection(),
    audioCueGroups: createEmptyEntityCollection(),
    musicGroupIds: [],
    initiativeTracker: {
      entries: [],
      currentActorId: null,
      currentRound: null
    },
    panelLayout: createPanelLayoutFromOrder(panelOrder),
    validationState: {
      mode: "ADVISORY",
      messages: []
    }
  };
}
