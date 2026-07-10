import { describe, expect, it } from "vitest";

import { createEncounterState } from "../../core/encounter/createEncounterState";
import { ZONELESS_ACTOR_ZONE_ID } from "../../core/encounter/types";
import { createEncounterActionRecord } from "../../core/history/createEncounterActionRecord";
import { calculateZoneLayout } from "../../core/layout/encounterLayout";
import type { EntityCollection } from "../../core/state/entityCollection";
import { prepareValidatedEncounterChange } from "../../core/validation/validatedEncounterChange";
import reducer, {
  commitEncounterChange,
  redoEncounterChange,
  undoEncounterChange
} from "../../store/encounterSlice";
import type { Zone } from "../zone/types";
import type { Actor } from "./types";
import {
  createActor,
  deleteActor,
  duplicateActor,
  moveActor,
  updateActorProperties
} from "./actorMutations";

function collection<TEntity extends { id: string }>(
  entities: TEntity[]
): EntityCollection<TEntity> {
  return {
    byId: Object.fromEntries(entities.map((entity) => [entity.id, entity])),
    allIds: entities.map((entity) => entity.id)
  };
}

const zoneA: Zone = {
  colorBorder: "#9b876b",
  colorFill: "#ffffff",
  id: "zone-a",
  layoutOrientation: "LEFT_RIGHT",
  layoutStrategy: "FLEX",
  name: "Zone A",
  namePosition: "top-left",
  opacity: 0.7,
  polygon: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 }
  ],
  shape: "rectangle",
  showBorder: true,
  showName: false,
  tags: []
};

const zoneB: Zone = {
  ...zoneA,
  id: "zone-b",
  name: "Zone B"
};

const actor: Actor = {
  actorType: "creature",
  currentZoneId: zoneA.id,
  id: "actor-hero",
  layoutGroup: "hero",
  metadata: {},
  name: "Hero",
  shape: "circle",
  size: "medium",
  statusEffects: []
};

function createActorEncounterState() {
  return {
    ...createEncounterState({
      id: "encounter-actors",
      name: "Actor Encounter"
    }),
    zones: collection([zoneA, zoneB]),
    actors: collection([actor])
  };
}

function commitState(
  state: ReturnType<typeof reducer>,
  type: string,
  nextEncounter: ReturnType<typeof createActorEncounterState>
) {
  return reducer(
    state,
    commitEncounterChange({
      action: createEncounterActionRecord(type),
      nextEncounter
    })
  );
}

describe("actor mutations", () => {
  it("uses image filenames without file extensions for default actor names", () => {
    const nextEncounter = createActor(createActorEncounterState(), {
      currentZoneId: zoneA.id,
      id: "actor-named-token",
      image: {
        dataUrl: "data:image/png;base64,token",
        mediaType: "image/png",
        name: "Goblin Captain.final.png"
      }
    });

    expect(nextEncounter.actors.byId["actor-named-token"]?.name).toBe(
      "Goblin Captain.final"
    );
    expect(
      nextEncounter.actors.byId["actor-named-token"]?.metadata.sourceAssetName
    ).toBe("Goblin Captain.final.png");
  });

  it("creates actors in zones and as zoneless actors with undo and redo", () => {
    const initialHistory = reducer(undefined, { type: "test/init" });
    let state = commitState(
      initialHistory,
      "test.seed",
      createActorEncounterState()
    );
    const withZoneActor = createActor(state.present, {
      currentZoneId: zoneA.id,
      id: "actor-token",
      image: {
        dataUrl: "data:image/png;base64,token",
        mediaType: "image/png",
        name: "token.png"
      },
      layoutGroup: "enemy",
      shape: "rectangle",
      size: "large"
    });

    state = commitState(state, "actor.create", withZoneActor);

    expect(state.present.actors.byId["actor-token"]).toMatchObject({
      currentZoneId: zoneA.id,
      image: "data:image/png;base64,token",
      layoutGroup: "enemy",
      shape: "rectangle",
      size: "large"
    });

    state = reducer(state, undoEncounterChange());
    expect(state.present.actors.byId["actor-token"]).toBeUndefined();

    state = reducer(state, redoEncounterChange());
    expect(state.present).toEqual(withZoneActor);

    const withZonelessActor = createActor(state.present, {
      currentZoneId: ZONELESS_ACTOR_ZONE_ID,
      id: "actor-zoneless"
    });

    state = commitState(state, "actor.create", withZonelessActor);
    expect(state.present.actors.byId["actor-zoneless"]?.currentZoneId).toBe(
      ZONELESS_ACTOR_ZONE_ID
    );
  });

  it("moves actors between zones and to zoneless state with exact undo and redo", () => {
    const initialHistory = reducer(undefined, { type: "test/init" });
    let state = commitState(
      initialHistory,
      "test.seed",
      createActorEncounterState()
    );
    const movedEncounter = moveActor(state.present, actor.id, zoneB.id);

    state = commitState(state, "actor.move", movedEncounter);

    expect(state.present.actors.byId[actor.id]?.currentZoneId).toBe(zoneB.id);
    expect(calculateZoneLayout(state.present, zoneA.id).descriptor.sections[0].items).toEqual([]);
    expect(calculateZoneLayout(state.present, zoneB.id).descriptor.sections[0].items).toEqual([
      { id: actor.id, layoutGroup: "hero" }
    ]);

    state = reducer(state, undoEncounterChange());
    expect(state.present.actors.byId[actor.id]?.currentZoneId).toBe(zoneA.id);

    state = reducer(state, redoEncounterChange());
    expect(state.present).toEqual(movedEncounter);

    const zonelessEncounter = moveActor(
      state.present,
      actor.id,
      ZONELESS_ACTOR_ZONE_ID
    );

    state = commitState(state, "actor.move", zonelessEncounter);
    expect(state.present.actors.byId[actor.id]?.currentZoneId).toBe(
      ZONELESS_ACTOR_ZONE_ID
    );
  });

  it("updates actor properties, duplicates actors, and deletes actors reversibly", () => {
    const initialHistory = reducer(undefined, { type: "test/init" });
    let state = commitState(
      initialHistory,
      "test.seed",
      createActorEncounterState()
    );
    const updatedEncounter = updateActorProperties(state.present, actor.id, {
      actorType: "objective",
      layoutGroup: "neutral",
      name: "Relic",
      shape: "rectangle",
      size: "xLarge"
    });

    state = commitState(state, "actor.updateProperties", updatedEncounter);
    expect(state.present.actors.byId[actor.id]).toMatchObject({
      actorType: "objective",
      layoutGroup: "neutral",
      name: "Relic",
      shape: "rectangle",
      size: "xLarge"
    });

    const duplicatedEncounter = duplicateActor(
      state.present,
      actor.id,
      "actor-copy",
      zoneB.id
    );
    state = commitState(state, "actor.duplicate", duplicatedEncounter);
    expect(state.present.actors.byId["actor-copy"]).toMatchObject({
      currentZoneId: zoneB.id,
      name: "Relic Copy"
    });

    const deletedEncounter = deleteActor(state.present, actor.id);
    state = commitState(state, "actor.delete", deletedEncounter);
    expect(state.present.actors.byId[actor.id]).toBeUndefined();

    state = reducer(state, undoEncounterChange());
    expect(state.present.actors.byId[actor.id]).toBeDefined();

    state = reducer(state, redoEncounterChange());
    expect(state.present).toEqual(deletedEncounter);
  });

  it("blocks invalid actor moves in STRICT mode and allows them with messages in ADVISORY mode", () => {
    const strictEncounter = {
      ...createActorEncounterState(),
      validationState: {
        messages: [],
        mode: "STRICT" as const
      }
    };
    const invalidMove = moveActor(strictEncounter, actor.id, "zone-missing");
    const strictResult = prepareValidatedEncounterChange({
      action: createEncounterActionRecord("actor.move", {
        actorId: actor.id,
        destinationZoneId: "zone-missing"
      }),
      currentEncounter: strictEncounter,
      nextEncounter: invalidMove
    });

    expect(strictResult.blocked).toBe(true);

    const advisoryEncounter = {
      ...strictEncounter,
      validationState: {
        messages: [],
        mode: "ADVISORY" as const
      }
    };
    const advisoryResult = prepareValidatedEncounterChange({
      action: createEncounterActionRecord("actor.move", {
        actorId: actor.id,
        destinationZoneId: "zone-missing"
      }),
      currentEncounter: advisoryEncounter,
      nextEncounter: moveActor(advisoryEncounter, actor.id, "zone-missing")
    });

    expect(advisoryResult.blocked).toBe(false);
    expect(advisoryResult.validationResult.messages).toEqual([
      expect.objectContaining({
        code: "movement.destinationZoneMissing"
      })
    ]);
  });
});
