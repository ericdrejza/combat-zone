import { describe, expect, it } from "vitest";

import { createEncounterState } from "@core/encounter/createEncounterState";
import {
  addActorsToInitiative,
  advanceInitiative,
  clearInitiative,
  endInitiative,
  getInitiativeActorIds,
  getInitiativeEntry,
  removeActorFromInitiative,
  removeActorsFromInitiative,
  reorderInitiativeActor,
  retreatInitiative,
  setCurrentInitiativeActor,
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

function actor(id: string, name: string): Actor {
  return {
    actorType: "creature",
    currentZoneId: "zoneless",
    id,
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
      actor("alpha", "Alpha"),
      actor("bravo", "Bravo"),
      actor("charlie", "Charlie"),
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
  it("alphabetizes each simultaneous batch while retaining existing blanks", () => {
    const initial = addActorsToInitiative(encounter(), ["delta"]);
    const added = addActorsToInitiative(initial, [
      "echo",
      "charlie",
      "alpha",
      "bravo",
      "missing",
      "alpha"
    ]);

    expect(getInitiativeActorIds(added)).toEqual([
      "delta",
      "alpha",
      "bravo",
      "charlie",
      "echo"
    ]);
    expect(addActorsToInitiative(added, ["alpha"])).toBe(added);
  });

  it("stably sorts edited actors within their new score group", () => {
    let initial = addActorsToInitiative(encounter(), [
      "alpha",
      "bravo",
      "charlie",
      "delta"
    ]);
    initial = updateInitiativeValue(initial, "alpha", 15);
    initial = updateInitiativeValue(initial, "bravo", 10);
    initial = updateInitiativeValue(initial, "charlie", 10);
    const changed = updateInitiativeValue(initial, "alpha", 10);
    const blanked = updateInitiativeValue(changed, "bravo", undefined);

    expect(getInitiativeActorIds(changed)).toEqual([
      "alpha",
      "bravo",
      "charlie",
      "delta"
    ]);
    expect(getInitiativeActorIds(blanked)).toEqual([
      "alpha",
      "charlie",
      "bravo",
      "delta"
    ]);
  });

  it("derives a dragged actor's score from the preceding or subsequent actor", () => {
    let initial = addActorsToInitiative(encounter(), ["alpha", "bravo", "delta"]);
    initial = updateInitiativeValue(initial, "alpha", 15);
    initial = updateInitiativeValue(initial, "bravo", 10);
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

    expect(getInitiativeEntry(movedBetween, "delta")?.value).toBe(15);
    expect(getInitiativeActorIds(movedBetween)).toEqual([
      "alpha",
      "delta",
      "bravo"
    ]);
    expect(getInitiativeEntry(movedFirst, "bravo")?.value).toBe(15);
    expect(getInitiativeActorIds(movedFirst)).toEqual([
      "bravo",
      "alpha",
      "delta"
    ]);

    const lone = addActorsToInitiative(encounter(), ["delta"]);
    expect(getInitiativeEntry(reorderInitiativeActor(lone, "delta", ["delta"]), "delta")?.value).toBeUndefined();
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
      entries: [{ actorId: "alpha" }, { actorId: "bravo" }],
      currentActorId: null,
      currentRound: null
    });
    expect(ended.actors).toBe(started.actors);
    assertExactHistory("initiative.end", started, ended);
  });

  it("sets a current participant without changing the round", () => {
    const started = advanceInitiative(
      advanceInitiative(
        startInitiative(
          addActorsToInitiative(encounter(), ["alpha", "bravo"])
        )
      )
    );
    const changed = setCurrentInitiativeActor(started, "bravo");

    expect(started.initiativeTracker.currentRound).toBe(2);
    expect(changed.initiativeTracker).toEqual({
      entries: [{ actorId: "alpha" }, { actorId: "bravo" }],
      currentActorId: "bravo",
      currentRound: 2
    });
    expect(
      setCurrentInitiativeActor(endInitiative(started), "bravo")
    ).toEqual(endInitiative(started));
    assertExactHistory("initiative.setCurrent", started, changed);
  });

  it("advances after removing the current actor and increments on wrap", () => {
    const listed = addActorsToInitiative(encounter(), ["alpha", "bravo"]);
    const firstRemoved = removeActorFromInitiative(startInitiative(listed), "alpha");
    const lastRemoved = removeActorFromInitiative(firstRemoved, "bravo");

    expect(firstRemoved.initiativeTracker).toEqual({
      entries: [{ actorId: "bravo" }],
      currentActorId: "bravo",
      currentRound: 1
    });
    expect(lastRemoved.initiativeTracker).toEqual({
      entries: [],
      currentActorId: null,
      currentRound: 1
    });

    const currentLast = advanceInitiative(startInitiative(listed));
    expect(removeActorFromInitiative(currentLast, "bravo").initiativeTracker).toEqual({
      entries: [{ actorId: "alpha" }],
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
      entries: [{ actorId: "bravo" }],
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

    expect(cleared.initiativeTracker).toEqual({
      entries: [],
      currentActorId: null,
      currentRound: 1
    });
    expect(advanceInitiative(cleared).initiativeTracker.currentRound).toBe(2);
    expect(retreatInitiative(advanceInitiative(cleared)).initiativeTracker.currentRound).toBe(1);
    const readdedDuringCombat = addActorsToInitiative(cleared, ["bravo", "alpha"]);
    expect(readdedDuringCombat.initiativeTracker).toEqual({
      entries: [{ actorId: "alpha" }, { actorId: "bravo" }],
      currentActorId: "alpha",
      currentRound: 1
    });

    assertExactHistory("initiative.addActors", initial, added);
    assertExactHistory("initiative.reorder", added, reordered);
    assertExactHistory("initiative.start", reordered, started);
    assertExactHistory("initiative.next", started, advanced);
    assertExactHistory("initiative.clear", advanced, cleared);
  });

  it("discards scoped values on remove and re-adds participants blank", () => {
    let listed = addActorsToInitiative(encounter(), ["alpha", "bravo"]);
    listed = updateInitiativeValue(listed, "alpha", 18);
    listed = updateInitiativeValue(listed, "bravo", 12);
    const removed = removeActorsFromInitiative(listed, ["alpha", "bravo"]);
    const readded = addActorsToInitiative(removed, ["alpha", "bravo"]);

    expect(removed.initiativeTracker.entries).toEqual([]);
    expect(readded.initiativeTracker.entries).toEqual([
      { actorId: "alpha" },
      { actorId: "bravo" }
    ]);
    assertExactHistory("initiative.removeActors", listed, removed);
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
        ...addActorsToInitiative(encounter(), ["alpha"]),
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
