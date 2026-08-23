import type { ValidationMode, ValidationMessage } from "../validation/types";
import type { EntityCollection, EntityId } from "../state/entityCollection";
import type { Actor } from "@entities/actor/types";
import type { Annotation } from "@entities/annotation/types";
import type { Edge } from "@entities/edge/types";
import type { Engagement } from "@entities/engagement/types";
import type { Zone } from "@entities/zone/types";
import type { CanvasSize } from "@core/layout/polygonCanvasBounds";

export const ENCOUNTER_SCHEMA_VERSION = 4;
export const ZONELESS_ACTOR_ZONE_ID = "zoneless";

export type EncounterSchemaVersion = typeof ENCOUNTER_SCHEMA_VERSION;
export type ZonelessActorZoneId = typeof ZONELESS_ACTOR_ZONE_ID;
export type ActorZoneAssignment = EntityId | ZonelessActorZoneId;

export type InitiativeTrackerState = {
  actorIds: EntityId[];
  currentActorId: EntityId | null;
  currentRound: number | null;
};

export type EncounterValidationState = {
  mode: ValidationMode;
  messages: ValidationMessage[];
};

export type EncounterBackgroundImage = {
  dataUrl: string;
  height: number;
  mediaType: string;
  name: string;
  width: number;
};

export type EncounterState = {
  schemaVersion: EncounterSchemaVersion;
  id: EntityId;
  name: string;
  backgroundImage: EncounterBackgroundImage | null;
  canvasSize: CanvasSize;
  zones: EntityCollection<Zone>;
  edges: EntityCollection<Edge>;
  actors: EntityCollection<Actor>;
  engagements: EntityCollection<Engagement>;
  annotations: EntityCollection<Annotation>;
  initiativeTracker: InitiativeTrackerState;
  validationState: EncounterValidationState;
};
