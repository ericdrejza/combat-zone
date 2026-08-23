import { describe, expect, it } from "vitest";

import { createEncounterState } from "@core/encounter/createEncounterState";
import {
  addActorsToInitiative,
  advanceInitiative,
  clearInitiative,
  endInitiative,
  removeActorFromInitiative,
  reorderInitiativeActor,
  retreatInitiative,
  startInitiative,
  updateInitiativeValue
} from "@core/encounter/initiativeMutations";
import type { EncounterState } from "@core/encounter/types";
import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import type { EntityCollection } from "@core/state/entityCollection";
import { prepareValidatedEncounterChange } from "@core/validation/validatedEncounterChange";
import type { Actor } from "@entities/actor/types";
import { deleteActor } from "@entities/actor/actorMutations";
import reducer, {
  commitEncounterChange,
  redoEncounterChange,
  undoEncounterChange
} from "@store/encounterSlice";

function collection<TEntity extends { id: string }>(
  entities: TEntity[]
): EntityCollection<TEntity> {
  return {
    allIds: entities.map(({ id }) => id),
    byId: Object.fromEntries(entities.map((entity) => [entity.id, entity]))
  };
}

function actor(id: string, name: string, initiative?: number): Actor {
  return {
    actorType: "creature",
    currentZoneId: "zoneless",
    id,
    initiative,
    layoutGroup: "neutral",
    metadata: {},
    name,
    shape: "circle",
    size: "medium",
    statusEffects: []
  };
}

function encounter(): EncounterState {
  return {
    ...createEncounterState({ id: "initiative", name: "Initiative" }),
    actors: collection([
      actor("alpha", "Alpha", 15),
      actor("bravo", "Bravo", 10),
      actor("charlie", "Charlie", 10),
      actor("delta", "Delta"),
      actor("echo", "Echo")
    ])
  };
}

function assertExactHistory(
  type: string,
  before: EncounterState,
  nextEncounter: EncounterState
) {
  let history = reducer(undefined, { type: "init" });
  history = reducer(
    history,
    commitEncounterChange({
      action: createEncounterActionRecord("test.seed"),
      nextEncounter: before
    })
  );
  history = reducer(
    history,
    commitEncounterChange({
      action: createEncounterActionRecord(type),
      nextEncounter
    })
  );
  const undone = reducer(history, undoEncounterChange());
  expect(undone.present).toEqual(before);
  expect(reducer(undone, redoEncounterChange()).present).toEqual(nextEncounter);
}

describe("initiative tracker mutations", () => {
  it("adds a simultaneous batch by score and alphabetizes ties and blanks", () => {
    const initial = addActorsToInitiative(encounter(), ["delta"]);
    const added = addActorsToInitiative(initial, [
      "echo",
      "charlie",
      "alpha",
      "bravo",
      "missing",
      "alpha"
    ]);

    expect(added.initiativeTracker.actorIds).toEqual([
      "alpha",
      "bravo",
      "charlie",
      "delta",
      "echo"
    ]);
    expect(addActorsToInitiative(added, ["alpha"])).toBe(added);
  });

  it("stably sorts edited actors within their new score group", () => {
    const initial = addActorsToInitiative(encounter(), [
      "alpha",
      "bravo",
      "charlie",
      "delta"
    ]);
    const changed = updateInitiativeValue(initial, "alpha", 10);
    const blanked = updateInitiativeValue(changed, "bravo", undefined);

    expect(changed.initiativeTracker.actorIds).toEqual([
      "alpha",
      "bravo",
      "charlie",
      "delta"
    ]);
    expect(blanked.initiativeTracker.actorIds).toEqual([
      "alpha",
      "charlie",
      "bravo",
      "delta"
    ]);
  });

  it("derives a dragged actor's score from the preceding or subsequent actor", () => {
    const initial = addActorsToInitiative(encounter(), ["alpha", "bravo", "delta"]);
    const movedBetween = reorderInitiativeActor(initial, "delta", [
      "alpha",
      "delta",
      "bravo"
    ]);
    const movedFirst = reorderInitiativeActor(movedBetween, "bravo", [
      "bravo",
      "alpha",
      "delta"
    ]);

    expect(movedBetween.actors.byId.delta?.initiative).toBe(15);
    expect(movedBetween.initiativeTracker.actorIds).toEqual([
      "alpha",
      "delta",
      "bravo"
    ]);
    expect(movedFirst.actors.byId.bravo?.initiative).toBe(15);
    expect(movedFirst.initiativeTracker.actorIds).toEqual([
      "bravo",
      "alpha",
      "delta"
    ]);

    const lone = addActorsToInitiative(encounter(), ["delta"]);
    expect(reorderInitiativeActor(lone, "delta", ["delta"]).actors.byId.delta?.initiative).toBeUndefined();
  });

  it("starts, advances, wraps rounds, retreats, and enforces the first-turn boundary", () => {
    const listed = addActorsToInitiative(encounter(), ["alpha", "bravo"]);
    const started = startInitiative(listed);

    expect(started.initiativeTracker).toMatchObject({
      currentActorId: "alpha",
      currentRound: 1
    });
    expect(retreatInitiative(started)).toBe(started);

    const second = advanceInitiative(started);
    const wrapped = advanceInitiative(second);
    const retreated = retreatInitiative(wrapped);
    expect(second.initiativeTracker.currentActorId).toBe("bravo");
    expect(wrapped.initiativeTracker).toMatchObject({
      currentActorId: "alpha",
      currentRound: 2
    });
    expect(retreated.initiativeTracker).toMatchObject({
      currentActorId: "bravo",
      currentRound: 1
    });
  });

  it("ends combat while preserving the initiative list and values", () => {
    const started = startInitiative(
      addActorsToInitiative(encounter(), ["alpha", "bravo"])
    );
    const ended = endInitiative(started);

    expect(ended.initiativeTracker).toEqual({
      actorIds: ["alpha", "bravo"],
      currentActorId: null,
      currentRound: null
    });
    expect(ended.actors).toBe(started.actors);
    assertExactHistory("initiative.end", started, ended);
  });

  it("advances after removing the current actor and increments on wrap", () => {
    const listed = addActorsToInitiative(encounter(), ["alpha", "bravo"]);
    const firstRemoved = removeActorFromInitiative(startInitiative(listed), "alpha");
    const lastRemoved = removeActorFromInitiative(firstRemoved, "bravo");

    expect(firstRemoved.initiativeTracker).toEqual({
      actorIds: ["bravo"],
      currentActorId: "bravo",
      currentRound: 1
    });
    expect(lastRemoved.initiativeTracker).toEqual({
      actorIds: [],
      currentActorId: null,
      currentRound: null
    });

    const currentLast = advanceInitiative(startInitiative(listed));
    expect(removeActorFromInitiative(currentLast, "bravo").initiativeTracker).toEqual({
      actorIds: ["alpha"],
      currentActorId: "alpha",
      currentRound: 2
    });
  });

  it("uses the same turn advancement when the current actor is deleted", () => {
    const listed = startInitiative(
      addActorsToInitiative(encounter(), ["alpha", "bravo"])
    );
    const deleted = deleteActor(listed, "alpha");

    expect(deleted.actors.byId.alpha).toBeUndefined();
    expect(deleted.initiativeTracker).toEqual({
      actorIds: ["bravo"],
      currentActorId: "bravo",
      currentRound: 1
    });
    assertExactHistory("actor.delete", listed, deleted);
  });

  it("clears the list and restores all initiative actions exactly", () => {
    const initial = encounter();
    const added = addActorsToInitiative(initial, ["alpha", "bravo"]);
    const reordered = reorderInitiativeActor(added, "bravo", ["bravo", "alpha"]);
    const started = startInitiative(reordered);
    const advanced = advanceInitiative(started);
    const cleared = clearInitiative(advanced);

    assertExactHistory("initiative.addActors", initial, added);
    assertExactHistory("initiative.reorder", added, reordered);
    assertExactHistory("initiative.start", reordered, started);
    assertExactHistory("initiative.next", started, advanced);
    assertExactHistory("initiative.clear", advanced, cleared);
  });

  it("preserves initiative through unrelated history commits", () => {
    const listed = startInitiative(
      addActorsToInitiative(encounter(), ["alpha", "bravo", "delta"])
    );
    const renamed = {
      ...listed,
      name: "Unrelated encounter rename"
    };
    assertExactHistory("encounter.rename", listed, renamed);
    expect(renamed.initiativeTracker).toEqual(listed.initiativeTracker);
  });

  it("warns in advisory mode and blocks in strict mode", () => {
    for (const mode of ["ADVISORY", "STRICT"] as const) {
      const initial = {
        ...encounter(),
        validationState: { messages: [], mode }
      };
      const invalid = updateInitiativeValue(initial, "alpha", 100);
      const prepared = prepareValidatedEncounterChange({
        action: createEncounterActionRecord("initiative.updateValue", {
          actorId: "alpha",
          initiative: 100
        }),
        currentEncounter: initial,
        nextEncounter: invalid
      });

      expect(prepared.validationResult.messages.map(({ code }) => code)).toContain(
        "initiative.valueInvalid"
      );
      expect(prepared.blocked).toBe(mode === "STRICT");
    }
  });
});
