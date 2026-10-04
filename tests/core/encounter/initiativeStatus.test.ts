import { createEncounterState } from "@core/encounter/createEncounterState";
import { addActorsToInitiative, advanceInitiative, retreatInitiative, startInitiative, removeActorFromInitiative } from "@core/encounter/initiativeMutations";
import type { EncounterState } from "@core/encounter/types";
import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { prepareValidatedEncounterChange } from "@core/validation/validatedEncounterChange";
import { createActor } from "@entities/actor/actorMutations";
import { getActorStatus, updateActorStatus } from "@entities/actor/actorStatus";
import type { ActorStatus } from "@entities/actor/types";
import reducer, { commitEncounterChange, undoEncounterChange, redoEncounterChange } from "@store/encounterSlice";

function encounter() {
  let state = createEncounterState({ id: "status", name: "Status" });
  for (const id of ["a", "b", "c", "d"]) state = createActor(state, { id, name: id, currentZoneId: "zoneless" });
  return addActorsToInitiative(state, ["a", "b", "c", "d"]);
}

function exactHistory(before: EncounterState, after: EncounterState) {
  let history = reducer(undefined, commitEncounterChange({ action: createEncounterActionRecord("test.seed"), nextEncounter: before }));
  history = reducer(history, commitEncounterChange({ action: createEncounterActionRecord("actor.updateStatus"), nextEncounter: after }));
  const undone = reducer(history, undoEncounterChange());
  expect(undone.present).toEqual(before);
  expect(reducer(undone, redoEncounterChange()).present).toEqual(after);
}

describe("initiative health statuses", () => {
  it("defaults to healthy and restores every status exactly through history", () => {
    const state = encounter();
    expect(getActorStatus(state.actors.byId.a)).toBe(3);
    for (const status of [0, 1, 2] as const) exactHistory(state, updateActorStatus(state, "a", status));
    expect(updateActorStatus(state, "a", 3)).toBe(state);
  });

  it("preserves health when removing and re-adding an initiative participant", () => {
    const state = updateActorStatus(encounter(), "a", 2);
    const removed = removeActorFromInitiative(state, "a");
    expect(removed.actors).toBe(state.actors);
    expect(addActorsToInitiative(removed, ["a"]).actors.byId.a.status).toBe(2);
    exactHistory(state, removed);
  });

  it("skips dead entries on Start and in both directions, including round boundaries", () => {
    let state = updateActorStatus(updateActorStatus(encounter(), "a", 0), "c", 0);
    state = startInitiative(state);
    expect(state.initiativeTracker.currentActorId).toBe("b");
    expect(retreatInitiative(state)).toBe(state);
    const next = advanceInitiative(state);
    expect(next.initiativeTracker.currentActorId).toBe("d");
    exactHistory(state, next);
    const wrapped = advanceInitiative(next);
    expect(wrapped.initiativeTracker).toMatchObject({ currentActorId: "b", currentRound: 2 });
    expect(retreatInitiative(wrapped).initiativeTracker).toEqual(next.initiativeTracker);
    exactHistory(next, wrapped);
    exactHistory(wrapped, retreatInitiative(wrapped));
  });

  it("retains a newly dead current actor until the user steps", () => {
    const started = startInitiative(encounter());
    const dead = updateActorStatus(started, "a", 0);
    expect(dead.initiativeTracker).toBe(started.initiativeTracker);
    expect(advanceInitiative(dead).initiativeTracker.currentActorId).toBe("b");
    exactHistory(started, dead);
  });

  it("does nothing when all participants are dead and wraps a single survivor", () => {
    let state = startInitiative(encounter());
    for (const id of state.actors.allIds) state = updateActorStatus(state, id, 0);
    expect(advanceInitiative(state)).toBe(state);
    expect(retreatInitiative(state)).toBe(state);
    const inactive = { ...state, initiativeTracker: { ...state.initiativeTracker, currentActorId: null, currentRound: null } };
    expect(startInitiative(inactive)).toBe(inactive);
    state = updateActorStatus(state, "a", 1);
    expect(advanceInitiative(state).initiativeTracker).toMatchObject({ currentActorId: "a", currentRound: 2 });
    expect(retreatInitiative(advanceInitiative(state)).initiativeTracker).toEqual(state.initiativeTracker);
  });

  it.each(["ADVISORY", "STRICT"] as const)("validates ordinal status in %s mode", (mode) => {
    const state = encounter();
    state.validationState.mode = mode;
    const invalid = updateActorStatus(state, "a", 4 as ActorStatus);
    const result = prepareValidatedEncounterChange({ action: createEncounterActionRecord("actor.updateStatus", { actorId: "a", status: 4 }), currentEncounter: state, nextEncounter: invalid });
    expect(result.validationResult.messages.map(({ code }) => code)).toContain("actor.statusInvalid");
    expect(result.blocked).toBe(mode === "STRICT");
  });
});
