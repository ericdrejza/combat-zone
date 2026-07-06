import type { Actor } from "../../entities/actor/types";
import type { Annotation } from "../../entities/annotation/types";
import type { Edge } from "../../entities/edge/types";
import type { Engagement } from "../../entities/engagement/types";
import type { Zone } from "../../entities/zone/types";
import type { EntityCollection } from "../state/entityCollection";
import { getEntities, getEntityById } from "../state/entityCollection";
import { createEncounterState } from "./createEncounterState";
import {
  getActorEngagement,
  getActorEngagementId,
  getActorsInZone,
  getEdgesConnectedToZone,
  getEngagementsInZone,
  getEngagementParticipants,
  getInitiativeActors,
  getPointOfInterestActorsInZone,
  getZoneRenderableEntities,
  getZonelessActors,
  isActorZoneless
} from "./inspectors";
import type { EncounterState } from "./types";
import { ENCOUNTER_SCHEMA_VERSION, ZONELESS_ACTOR_ZONE_ID } from "./types";

function collection<TEntity extends { id: string }>(
  entities: TEntity[]
): EntityCollection<TEntity> {
  return {
    byId: Object.fromEntries(entities.map((entity) => [entity.id, entity])),
    allIds: entities.map((entity) => entity.id)
  };
}

const courtyardZone: Zone = {
  id: "zone-courtyard",
  name: "Courtyard",
  polygon: [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 }
  ],
  layoutStrategy: "FLEX",
  layoutOrientation: "LEFT_RIGHT",
  tags: ["outdoor"]
};

const towerZone: Zone = {
  id: "zone-tower",
  name: "Tower",
  polygon: [
    { x: 20, y: 0 },
    { x: 30, y: 0 },
    { x: 30, y: 10 }
  ],
  layoutStrategy: "SEQUENTIAL",
  layoutOrientation: "TOP_BOTTOM",
  tags: []
};

const heroActor: Actor = {
  id: "actor-hero",
  name: "Hero",
  actorType: "creature",
  layoutGroup: "hero",
  currentZoneId: "zone-courtyard",
  initiative: 15,
  statusEffects: [],
  metadata: {},
  stats: { hp: 12 }
};

const goblinActor: Actor = {
  id: "actor-goblin",
  name: "Goblin",
  actorType: "creature",
  layoutGroup: "enemy",
  currentZoneId: ZONELESS_ACTOR_ZONE_ID,
  initiative: 11,
  statusEffects: ["hidden"],
  metadata: { faction: "enemy" }
};

const statueActor: Actor = {
  id: "actor-statue",
  name: "Ancient Statue",
  actorType: "pointOfInterest",
  layoutGroup: "neutral",
  currentZoneId: "zone-courtyard",
  statusEffects: [],
  metadata: {}
};

const meleeEngagement: Engagement = {
  id: "engagement-melee",
  participantIds: ["actor-hero", "actor-goblin"],
  parentZoneId: "zone-courtyard",
  layoutStrategy: "FLEX",
  layoutOrientation: "LEFT_RIGHT"
};

const towerEdge: Edge = {
  id: "edge-courtyard-tower",
  fromZoneId: "zone-courtyard",
  toZoneId: "zone-tower",
  directionality: "two-way",
  movementRule: "free",
  visibilityRule: "clear",
  interactionTags: ["stairs"],
  notes: "Stone stairs connect the spaces."
};

const markerAnnotation: Annotation = {
  id: "annotation-marker",
  kind: "marker",
  label: "Alarm bell",
  metadata: {}
};

function createPopulatedEncounterState(): EncounterState {
  return {
    ...createEncounterState({
      id: "encounter-ambush",
      name: "Courtyard Ambush"
    }),
    zones: collection([courtyardZone, towerZone]),
    actors: collection([heroActor, goblinActor, statueActor]),
    engagements: collection([meleeEngagement]),
    edges: collection([towerEdge]),
    annotations: collection([markerAnnotation]),
    initiativeTracker: {
      actorIds: ["actor-hero", "actor-goblin"],
      currentActorId: "actor-hero"
    },
    validationState: {
      mode: "ADVISORY",
      messages: [
        {
          code: "movement.warning",
          message: "Movement warning",
          severity: "warning"
        }
      ]
    }
  };
}

describe("EncounterState foundation", () => {
  it("creates the full root encounter runtime state shape", () => {
    const state = createEncounterState({
      id: "encounter-empty",
      name: "Empty Encounter"
    });

    expect(state).toEqual({
      schemaVersion: ENCOUNTER_SCHEMA_VERSION,
      id: "encounter-empty",
      name: "Empty Encounter",
      backgroundImage: null,
      zones: { byId: {}, allIds: [] },
      edges: { byId: {}, allIds: [] },
      actors: { byId: {}, allIds: [] },
      engagements: { byId: {}, allIds: [] },
      annotations: { byId: {}, allIds: [] },
      initiativeTracker: {
        actorIds: [],
        currentActorId: null
      },
      validationState: {
        mode: "ADVISORY",
        messages: []
      }
    });
  });

  it("stores entity data as normalized NoSQL-style collections", () => {
    const state = createPopulatedEncounterState();

    expect(state.zones.allIds).toEqual(["zone-courtyard", "zone-tower"]);
    expect(state.zones.byId["zone-courtyard"]).toBe(courtyardZone);
    expect(getEntityById(state.actors, "actor-hero")).toBe(heroActor);
    expect(getEntities(state.edges)).toEqual([towerEdge]);
  });

  it("models the documented entity relationships without pairwise engagements or geometric edges", () => {
    const state = createPopulatedEncounterState();

    expect(state.zones.byId["zone-courtyard"]).toMatchObject({
      polygon: courtyardZone.polygon,
      layoutStrategy: "FLEX",
      layoutOrientation: "LEFT_RIGHT",
      tags: ["outdoor"]
    });
    expect(state.actors.byId["actor-hero"]).toMatchObject({
      actorType: "creature",
      layoutGroup: "hero",
      currentZoneId: "zone-courtyard"
    });
    expect(state.actors.byId["actor-statue"]).toMatchObject({
      actorType: "pointOfInterest",
      currentZoneId: "zone-courtyard"
    });
    expect(state.engagements.byId["engagement-melee"].participantIds).toEqual([
      "actor-hero",
      "actor-goblin"
    ]);
    expect(state.edges.byId["edge-courtyard-tower"]).toMatchObject({
      fromZoneId: "zone-courtyard",
      toZoneId: "zone-tower",
      directionality: "two-way",
      movementRule: "free",
      visibilityRule: "clear"
    });
  });

  it("represents zoneless actors explicitly", () => {
    expect(goblinActor.currentZoneId).toBe(ZONELESS_ACTOR_ZONE_ID);
    expect(isActorZoneless(goblinActor)).toBe(true);
    expect(isActorZoneless(heroActor)).toBe(false);
  });

  it("provides baseline inspection helpers for acceptance tests", () => {
    const state = createPopulatedEncounterState();

    expect(getActorsInZone(state, "zone-courtyard")).toEqual([
      heroActor,
      statueActor
    ]);
    expect(getPointOfInterestActorsInZone(state, "zone-courtyard")).toEqual([
      statueActor
    ]);
    expect(getEngagementsInZone(state, "zone-courtyard")).toEqual([
      meleeEngagement
    ]);
    expect(getActorEngagement(state, "actor-hero")).toBe(meleeEngagement);
    expect(getActorEngagementId(state, "actor-hero")).toBe("engagement-melee");
    expect(getActorEngagement(state, "actor-statue")).toBeUndefined();
    expect(getActorEngagementId(state, "actor-statue")).toBeUndefined();
    expect(getZoneRenderableEntities(state, "zone-courtyard")).toEqual([
      { entityType: "actor", entity: heroActor },
      { entityType: "actor", entity: statueActor },
      { entityType: "engagement", entity: meleeEngagement }
    ]);
    expect(getZonelessActors(state)).toEqual([goblinActor]);
    expect(getEdgesConnectedToZone(state, "zone-courtyard")).toEqual([towerEdge]);
    expect(getEngagementParticipants(state, "engagement-melee")).toEqual([
      heroActor,
      goblinActor
    ]);
    expect(getInitiativeActors(state)).toEqual([heroActor, goblinActor]);
  });
});
