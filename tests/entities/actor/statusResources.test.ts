import { createEncounterState } from "@core/encounter/createEncounterState";
import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { createEncounterHistoryState } from "@core/history/types";
import { prepareValidatedEncounterChange } from "@core/validation/validatedEncounterChange";
import reducer, { commitEncounterChange, undoEncounterChange, redoEncounterChange } from "@store/encounterSlice";
import { createActor, duplicateActor } from "@entities/actor/actorMutations";
import { updateActorStatus } from "@entities/actor/actorStatus";
import { DEFAULT_COMBAT_RULES, automaticStatus, normalizeHitPoints, validThresholds, validActorResources, type CombatRules } from "@entities/actor/actorResources";
import { adjustHitPoints, applyCombatRules, removeCounter, saveCounter, setHitPoints, toggleMarker, updateSelectedActors } from "@entities/actor/statusMutations";

const rules: CombatRules = { ...DEFAULT_COMBAT_RULES, automaticHealth: true, thresholds: [0, 5, 10] };
function state() {
  let state = createActor(createActor(createEncounterState({ id: "resources", name: "Resources" }), { id: "a", currentZoneId: "zoneless" }), { id: "b", currentZoneId: "zoneless" });
  return updateSelectedActors(state, ["a", "b"], (actor) => setHitPoints(actor, { current: 20, maximum: 20 }, rules));
}

describe("actor resources and markers", () => {
  it.each([0, 1, 2, 3] as const)("restores HP plus automatic status %s atomically through history", (status) => {
    const initial = state();
    const amount = [20, 15, 10, 1][status];
    const next = adjustHitPoints(initial, ["a", "b"], -amount, rules);
    const action = createEncounterActionRecord("actor.adjustHitPoints");
    let history = reducer(createEncounterHistoryState(initial), commitEncounterChange({ action, nextEncounter: next }));
    expect(history.past).toHaveLength(1);
    expect(history.present.actors.byId.a.status).toBe(status);
    expect(history.present.actors.byId.b.hitPoints).toEqual({ current: 20 - amount, maximum: 20 });
    history = reducer(history, undoEncounterChange());
    expect(history.present).toEqual(initial);
    history = reducer(history, redoEncounterChange());
    expect(history.present).toEqual(next);
  });
  it.each(["bounded", "negative", "unbounded"] as const)("applies %s limits to direct edits and adjustments", (limits) => {
    const config = { ...rules, limits };
    expect(normalizeHitPoints({ current: -4, maximum: 20 }, config).current).toBe(limits === "bounded" ? 0 : -4);
    expect(normalizeHitPoints({ current: 24, maximum: 20 }, config).current).toBe(limits === "unbounded" ? 24 : 20);
    const next = adjustHitPoints(state(), ["a"], 4, config);
    expect(next.actors.byId.a.hitPoints?.current).toBe(limits === "unbounded" ? 24 : 20);
  });
  it("preserves manual overrides on no-op HP, recalculates on effective changes and explicit Apply", () => {
    const initial = updateActorStatus(state(), "a", 0);
    expect(adjustHitPoints(initial, ["a"], 1, rules)).toBe(initial);
    expect(adjustHitPoints(initial, ["a"], -1, rules).actors.byId.a.status).toBe(3);
    expect(applyCombatRules(initial, rules).actors.byId.a.status).toBe(3);
    expect(applyCombatRules(initial, { ...rules, automaticHealth: false })).toBe(initial);
  });
  it("handles percentage boundaries without rounding and uses severe tied thresholds", () => {
    const percent = { ...rules, unit: "percent" as const, thresholds: [0, 25, 50] as CombatRules["thresholds"] };
    expect(automaticStatus({ current: 5, maximum: 20 }, percent)).toBe(1);
    expect(automaticStatus({ current: 5, maximum: 19 }, percent)).toBe(2);
    expect(automaticStatus({ current: 0, maximum: 20 }, { ...rules, thresholds: [0, 0, 0] })).toBe(0);
    expect(automaticStatus({ current: -10, maximum: 20 }, rules)).toBe(0);
    for (const thresholds of [[null, null, null], [1, 0, 10], [0, 1.5, 10], [0, 20, 101]]) {
      expect(validThresholds({ ...percent, thresholds: thresholds as CombatRules["thresholds"] })).toBe(false);
    }
  });
  it("applies mixed markers to all, clears all, and replaces armor without losing unknown markers", () => {
    let initial = state();
    initial = updateSelectedActors(initial, ["a"], (actor) => ({ ...actor, statusEffects: ["hidden", "custom", "armor:light"] }));
    initial = updateSelectedActors(initial, ["b"], (actor) => ({ ...actor, statusEffects: ["armor:heavy"] }));
    const applied = toggleMarker(initial, ["a", "b"], "hidden");
    expect(applied.actors.byId.a.statusEffects).toContain("custom");
    expect(applied.actors.byId.b.statusEffects).toContain("hidden");
    const cleared = toggleMarker(applied, ["a", "b"], "hidden");
    expect(cleared.actors.byId.a.statusEffects).not.toContain("hidden");
    const armor = toggleMarker(applied, ["a", "b"], "armor:medium", ["armor:light", "armor:medium", "armor:heavy", "armor:no-armor"]);
    expect(armor.actors.byId.a.statusEffects).toEqual(["hidden", "custom", "armor:medium"]);
    expect(armor.actors.byId.b.statusEffects).toEqual(["hidden", "armor:medium"]);
    expect(toggleMarker(armor, ["a", "b"], "armor:medium").actors.byId.a.statusEffects).toEqual(["hidden", "custom"]);
  });
  it("clamps counters and keeps duplicated actors independent", () => {
    let initial = updateSelectedActors(state(), ["a"], (actor) => saveCounter(actor, { id: "c", name: "Charges", value: 20, minimum: 0, maximum: 3 }));
    expect(initial.actors.byId.a.counters?.byId.c.value).toBe(3);
    initial = duplicateActor(initial, "a", "copy", "zoneless");
    const edited = updateSelectedActors(initial, ["copy"], (actor) => saveCounter(actor, { ...actor.counters!.byId.c, value: -1 }));
    expect(edited.actors.byId.copy.counters?.byId.c.value).toBe(0);
    expect(edited.actors.byId.a.counters?.byId.c.value).toBe(3);
    expect(removeCounter(edited.actors.byId.copy, "c").counters?.allIds).toEqual([]);
    expect(validActorResources({ counters: { allIds: ["c"], byId: { c: { id: "c", name: "X", value: 0, minimum: 2, maximum: 1 } } } })).toBe(false);
  });
  it.each(["STRICT", "ADVISORY"] as const)("validates resources in %s", (mode) => {
    const initial = { ...state(), validationState: { mode, messages: [] } };
    const next = updateSelectedActors(initial, ["a"], (actor) => ({ ...actor, hitPoints: { current: 1.5, maximum: 0 } }));
    const prepared = prepareValidatedEncounterChange({ currentEncounter: initial, nextEncounter: next, action: createEncounterActionRecord("actor.setHitPoints") });
    expect(prepared.blocked).toBe(mode === "STRICT");
    expect(prepared.validationResult.messages).toContainEqual(expect.objectContaining({ code: "actor.resourcesInvalid" }));
  });
  it("undoes each counter create/edit/remove and ignores equivalent counter edits", () => {
    const initial = state();
    const created = updateSelectedActors(initial, ["a"], (actor) => saveCounter(actor, { id: "c", name: "Charges", value: 1 }));
    expect(updateSelectedActors(created, ["a"], (actor) => saveCounter(actor, { value: 1, name: "Charges", id: "c" }))).toBe(created);
    const edited = updateSelectedActors(created, ["a"], (actor) => saveCounter(actor, { id: "c", name: "Power", value: 2, maximum: 5 }));
    const removed = updateSelectedActors(edited, ["a"], (actor) => removeCounter(actor, "c"));
    const snapshots = [initial, created, edited, removed];
    let history = createEncounterHistoryState(initial);
    for (const nextEncounter of snapshots.slice(1)) history = reducer(history, commitEncounterChange({ action: createEncounterActionRecord("actor.counter"), nextEncounter }));
    for (const expected of snapshots.slice(0, -1).reverse()) { history = reducer(history, undoEncounterChange()); expect(history.present).toEqual(expected); }
    for (const expected of snapshots.slice(1)) { history = reducer(history, redoEncounterChange()); expect(history.present).toEqual(expected); }
  });
  it("undoes and redoes counters and marker changes", () => {
    const initial = state();
    const counter = updateSelectedActors(initial, ["a"], (actor) => saveCounter(actor, { id: "c", name: "Charges", value: 1 }));
    const marked = toggleMarker(counter, ["a", "b"], "stunned");
    let history = createEncounterHistoryState(initial);
    for (const nextEncounter of [counter, marked]) history = reducer(history, commitEncounterChange({ action: createEncounterActionRecord("actor.status"), nextEncounter }));
    history = reducer(history, undoEncounterChange()); expect(history.present).toEqual(counter);
    history = reducer(history, undoEncounterChange()); expect(history.present).toEqual(initial);
    history = reducer(history, redoEncounterChange()); history = reducer(history, redoEncounterChange()); expect(history.present).toEqual(marked);
  });
});
