import { createEncounterState } from "@core/encounter/createEncounterState";
import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { prepareValidatedEncounterChange } from "@core/validation/validatedEncounterChange";
import { createActor } from "@entities/actor/actorMutations";
import { removeMarker } from "@entities/actor/statusMutations";

it("removes only the named condition and ignores repeated removals", () => {
  const state = createActor(createEncounterState({ id: "remove-condition", name: "Conditions" }), { id: "a", currentZoneId: "zoneless" });
  state.actors.byId.a.statusEffects = ["blinded", "burning", "weapon:sword", "armor:heavy", "custom"];
  const next = removeMarker(state, "a", "blinded");
  expect(next.actors.byId.a.statusEffects).toEqual(["burning", "weapon:sword", "armor:heavy", "custom"]);
  expect(state.actors.byId.a.statusEffects).toContain("blinded");
  expect(removeMarker(next, "a", "blinded")).toBe(next);
  expect(removeMarker(next, "missing", "burning")).toBe(next);
});
it.each(["STRICT", "ADVISORY"] as const)("respects %s validation when removing a condition", (mode) => {
  const state = createActor(createEncounterState({ id: "remove-condition", name: "Conditions" }), { id: "a", currentZoneId: "zoneless" });
  state.validationState.mode = mode;
  state.actors.byId.a.currentZoneId = "missing";
  state.actors.byId.a.statusEffects = ["blinded"];
  const prepared = prepareValidatedEncounterChange({ currentEncounter: state, nextEncounter: removeMarker(state, "a", "blinded"), action: createEncounterActionRecord("actor.removeCondition", { actorId: "a", condition: "blinded" }) });
  expect(prepared.blocked).toBe(mode === "STRICT");
});
