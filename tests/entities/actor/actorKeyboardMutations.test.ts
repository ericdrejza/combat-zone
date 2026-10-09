import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { prepareValidatedEncounterChange } from "@core/validation/validatedEncounterChange";
import { getActorPasteDestination, moveActorsByDestination, stepActorSizes } from "@entities/actor/actorKeyboardMutations";
import { duplicateActor } from "@entities/actor/actorMutations";
import reducer, { loadEncounterState, commitEncounterChange, undoEncounterChange, redoEncounterChange } from "@store/encounterSlice";
import { actor, collection, createActorEncounterState, zoneA } from "./actorMutationsTestSupport";

function state() {
  const state = createActorEncounterState();
  state.canvasSize = { width: 1200, height: 800 };
  const roomy = { ...zoneA, polygon: zoneA.polygon.map((p) => ({ x: p.x * 2, y: p.y * 2 })) };
  state.zones = collection([roomy, { ...roomy, id: "b", polygon: roomy.polygon.map((p) => ({ x: p.x + 300, y: p.y })) }, { ...roomy, id: "c", polygon: roomy.polygon.map((p) => ({ x: p.x + 600, y: p.y })) }]);
  state.actors = collection([actor, { ...actor, id: "second", size: "small" }]);
  return structuredClone(state);
}
function history(initial: ReturnType<typeof state>, type: string, next: ReturnType<typeof state>) {
  const seed = reducer(undefined, loadEncounterState(initial));
  const changed = reducer(seed, commitEncounterChange({ action: createEncounterActionRecord(type), nextEncounter: next }));
  expect(reducer(changed, undoEncounterChange()).present).toEqual(initial);
  expect(reducer(reducer(changed, undoEncounterChange()), redoEncounterChange()).present).toEqual(next);
}

describe("keyboard actor mutations", () => {
  it("moves complete Engagements atomically and restores memberships through history", () => {
    const initial = state(); initial.engagements = collection([{ id: "e", parentZoneId: zoneA.id, participantIds: [actor.id, "second"], layoutStrategy: "FLEX", layoutOrientation: "LEFT_RIGHT" }]);
    const next = moveActorsByDestination(initial, { [actor.id]: "b", second: "b" });
    expect(next.engagements.byId.e.parentZoneId).toBe("b");
    expect(next.engagements.byId.e.participantIds).toEqual([actor.id, "second"]);
    history(initial, "actor.moveMany", next);
    const split = moveActorsByDestination(initial, { [actor.id]: "b", second: "c" });
    expect(split.engagements.allIds).toEqual([]);
    history(initial, "actor.moveMany", split);
  });
  it("leaves stationary participants in their original Engagement", () => {
    const initial = state(); initial.actors = collection([actor, { ...actor, id: "second" }, { ...actor, id: "third" }]);
    initial.engagements = collection([{ id: "e", parentZoneId: zoneA.id, participantIds: [actor.id, "second", "third"], layoutStrategy: "FLEX", layoutOrientation: "LEFT_RIGHT" }]);
    const next = moveActorsByDestination(initial, { [actor.id]: "b", second: zoneA.id, third: zoneA.id });
    expect(next.engagements.byId.e.participantIds).toEqual(["second", "third"]);
    history(initial, "actor.moveMany", next);
    expect(moveActorsByDestination(initial, { [actor.id]: zoneA.id })).toBe(initial);
  });
  it("steps each actor by category, skips bounds, and supports undo/redo", () => {
    const initial = state(); initial.actors.byId.second.size = "xLarge";
    const next = stepActorSizes(initial, [actor.id, "second"], 1);
    expect(next.actors.byId[actor.id].size).toBe("large");
    expect(next.actors.byId.second).toBe(initial.actors.byId.second);
    history(initial, "actor.updateProperties", next);
    expect(stepActorSizes(initial, ["second"], 1)).toBe(initial);
    const atMinimum = structuredClone(initial); atMinimum.actors.byId.second.size = "small";
    expect(stepActorSizes(atMinimum, ["second"], -1)).toBe(atMinimum);
  });
  it("prefers a valid copied zone, then selected zone, then zoneless", () => {
    const initial = state();
    expect(getActorPasteDestination(initial, actor.id, "b")).toBe(zoneA.id);
    initial.actors.byId[actor.id].currentZoneId = "zoneless";
    expect(getActorPasteDestination(initial, actor.id, "b")).toBe("b");
    expect(getActorPasteDestination(initial, actor.id, "missing")).toBe("zoneless");
    history(initial, "actor.duplicate", duplicateActor(initial, actor.id, "copy", getActorPasteDestination(initial, actor.id, "b")));
  });
  it.each(["STRICT", "ADVISORY"] as const)("validates all per-actor destinations in %s", (mode) => {
    const initial = state(); initial.validationState.mode = mode;
    const prepared = prepareValidatedEncounterChange({ currentEncounter: initial, nextEncounter: initial, action: createEncounterActionRecord("actor.moveMany", { actorIds: [actor.id, "second"], destinations: { [actor.id]: "b", second: "missing" } }) });
    expect(prepared.validationResult.messages.some((m) => m.code === "movement.destinationZoneMissing")).toBe(true);
    expect(prepared.blocked).toBe(mode === "STRICT");
  });
  it.each(["OFF", "ADVISORY", "ASSISTED", "STRICT"] as const)("rejects movement into an impossible footprint in %s", (mode) => {
    const initial = state(); initial.validationState.mode = mode;
    initial.zones.byId.b.polygon = [{ x: 300, y: 0 }, { x: 305, y: 0 }, { x: 305, y: 5 }, { x: 300, y: 5 }];
    const prepared = prepareValidatedEncounterChange({ currentEncounter: initial, nextEncounter: moveActorsByDestination(initial, { [actor.id]: "b" }), action: createEncounterActionRecord("actor.moveMany", { actorIds: [actor.id], destinations: { [actor.id]: "b" } }) });
    expect(prepared.blocked).toBe(true);
  });
  it.each(["STRICT", "ADVISORY", "ASSISTED"] as const)("retains footprint enlargement rules for bulk size changes in %s", (mode) => {
    const initial = state(); initial.actors = collection([actor]); initial.validationState.mode = mode;
    initial.zones.byId[zoneA.id].polygon = [{ x: 0, y: 0 }, { x: 70, y: 0 }, { x: 70, y: 70 }, { x: 0, y: 70 }];
    const prepared = prepareValidatedEncounterChange({ currentEncounter: initial, nextEncounter: stepActorSizes(initial, [actor.id], 1), action: createEncounterActionRecord("actor.updateProperties", { actorIds: [actor.id], sizeStep: 1 }) });
    expect(prepared.blocked).toBe(mode !== "ADVISORY");
    expect(prepared.requiresConfirmation).toBe(mode === "ASSISTED");
  });
});
