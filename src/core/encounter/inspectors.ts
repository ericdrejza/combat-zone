import type { Actor } from "../../entities/actor/types";
import type { Edge } from "../../entities/edge/types";
import type { Engagement } from "../../entities/engagement/types";
import type { Zone } from "../../entities/zone/types";
import type { EntityId } from "../state/entityCollection";
import { getEntities, getEntityById } from "../state/entityCollection";
import type { EncounterState } from "./types";
import { ZONELESS_ACTOR_ZONE_ID } from "./types";

export type ZoneRenderableEntity =
  | { entityType: "actor"; entity: Actor }
  | { entityType: "engagement"; entity: Engagement };

export function getZone(state: EncounterState, zoneId: EntityId): Zone | undefined {
  return getEntityById(state.zones, zoneId);
}

export function getActor(state: EncounterState, actorId: EntityId): Actor | undefined {
  return getEntityById(state.actors, actorId);
}

export function getEngagement(
  state: EncounterState,
  engagementId: EntityId
): Engagement | undefined {
  return getEntityById(state.engagements, engagementId);
}

export function getEdge(state: EncounterState, edgeId: EntityId): Edge | undefined {
  return getEntityById(state.edges, edgeId);
}

export function getActorsInZone(state: EncounterState, zoneId: EntityId): Actor[] {
  return getEntities(state.actors).filter((actor) => actor.currentZoneId === zoneId);
}

export function getPointOfInterestActorsInZone(
  state: EncounterState,
  zoneId: EntityId
): Actor[] {
  return getActorsInZone(state, zoneId).filter(
    (actor) => actor.actorType === "pointOfInterest"
  );
}

export function getEngagementsInZone(
  state: EncounterState,
  zoneId: EntityId
): Engagement[] {
  return getEntities(state.engagements).filter(
    (engagement) => engagement.parentZoneId === zoneId
  );
}

export function getActorEngagement(
  state: EncounterState,
  actorId: EntityId
): Engagement | undefined {
  return getEntities(state.engagements).find((engagement) =>
    engagement.participantIds.includes(actorId)
  );
}

export function getActorEngagementId(
  state: EncounterState,
  actorId: EntityId
): EntityId | undefined {
  return getActorEngagement(state, actorId)?.id;
}

export function getZoneRenderableEntities(
  state: EncounterState,
  zoneId: EntityId
): ZoneRenderableEntity[] {
  return [
    ...getActorsInZone(state, zoneId).map((actor) => ({
      entityType: "actor" as const,
      entity: actor
    })),
    ...getEngagementsInZone(state, zoneId).map((engagement) => ({
      entityType: "engagement" as const,
      entity: engagement
    }))
  ];
}

export function getZonelessActors(state: EncounterState): Actor[] {
  return getEntities(state.actors).filter(isActorZoneless);
}

export function isActorZoneless(actor: Actor): boolean {
  return actor.currentZoneId === ZONELESS_ACTOR_ZONE_ID;
}

export function getEdgesConnectedToZone(state: EncounterState, zoneId: EntityId): Edge[] {
  return getEntities(state.edges).filter(
    (edge) => edge.fromZoneId === zoneId || edge.toZoneId === zoneId
  );
}

export function getEngagementParticipants(
  state: EncounterState,
  engagementId: EntityId
): Actor[] {
  const engagement = getEngagement(state, engagementId);

  if (!engagement) {
    return [];
  }

  return engagement.participantIds
    .map((actorId) => getActor(state, actorId))
    .filter((actor): actor is Actor => Boolean(actor));
}

export function getInitiativeActors(state: EncounterState): Actor[] {
  return state.initiativeTracker.actorIds
    .map((actorId) => getActor(state, actorId))
    .filter((actor): actor is Actor => Boolean(actor));
}
