import { createEncounterState } from "@core/encounter/createEncounterState";
import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { createEncounterHistoryState } from "@core/history/types";
import { prepareValidatedEncounterChange } from "@core/validation/validatedEncounterChange";
import { createActor } from "@entities/actor/actorMutations";
import { automaticStatus, DEFAULT_COMBAT_RULES, validThresholds, type CombatRules } from "@entities/actor/actorResources";
import { adjustHitPoints, recalculateHealthStatuses } from "@entities/actor/statusMutations";
import reducer, { commitEncounterChange, undoEncounterChange, redoEncounterChange } from "@store/encounterSlice";

const rules: CombatRules = { ...DEFAULT_COMBAT_RULES, automaticHealth: true, thresholds: [null, 5, 10] };
it("accepts gaps in ordered thresholds and skips every unset status", () => {
  for (const thresholds of [[null, 5, 10], [0, null, 10], [null, null, 10], [0, null, null]]) {
    expect(validThresholds({ ...rules, thresholds: thresholds as CombatRules["thresholds"] })).toBe(true);
  }
  expect(validThresholds({ ...rules, thresholds: [null, null, null] })).toBe(false);
  expect(validThresholds({ ...rules, thresholds: [10, null, 5] })).toBe(false);
  expect(automaticStatus({ current: 0, maximum: 20 }, rules)).toBe(1);
  expect(automaticStatus({ current: 6, maximum: 20 }, rules)).toBe(2);
  expect(automaticStatus({ current: 11, maximum: 20 }, rules)).toBe(3);
  expect(automaticStatus({ current: 0, maximum: 20 }, { ...rules, thresholds: [null, null, 10] })).toBe(2);
  expect(automaticStatus({ current: 1, maximum: 20 }, { ...rules, unit: "percent", thresholds: [null, 5, null] })).toBe(1);
});
it("keeps statuses with blank thresholds under manual control during HP updates", () => {
  expect(automaticStatus({ current: 20, maximum: 20 }, rules, 0)).toBe(0);
  const state = createActor(createEncounterState({ id: "partial-health", name: "Partial health" }), { id: "a", currentZoneId: "zoneless" });
  state.actors.byId.a.status = 0;
  state.actors.byId.a.hitPoints = { current: 0, maximum: 20 };
  const next = adjustHitPoints(state, ["a"], 10, rules);
  expect(next.actors.byId.a.hitPoints?.current).toBe(10);
  expect(next.actors.byId.a.status).toBe(0);
});
it.each(["STRICT", "ADVISORY"] as const)("recalculates all actors atomically without changing HP in %s", (mode) => {
  let state = createActor(createActor(createEncounterState({ id: "partial-health", name: "Partial health" }), { id: "a", currentZoneId: "zoneless" }), { id: "b", currentZoneId: "zoneless" });
  state = { ...state, validationState: { mode, messages: [] } };
  state.actors.byId.a.hitPoints = { current: -5, maximum: 20 };
  state.actors.byId.b.hitPoints = { current: 9, maximum: 20 };
  const next = recalculateHealthStatuses(state, rules);
  expect(next.actors.byId.a.status).toBe(1);
  expect(next.actors.byId.b.status).toBe(2);
  expect(next.actors.byId.a.hitPoints).toEqual(state.actors.byId.a.hitPoints);
  const action = createEncounterActionRecord("actor.recalculateHealth");
  const prepared = prepareValidatedEncounterChange({ currentEncounter: state, nextEncounter: next, action });
  expect(prepared.blocked).toBe(false);
  let history = reducer(createEncounterHistoryState(state), commitEncounterChange({ action, nextEncounter: next }));
  expect(history.past).toHaveLength(1);
  history = reducer(history, undoEncounterChange());
  expect(history.present).toEqual(state);
  history = reducer(history, redoEncounterChange());
  expect(history.present).toEqual(next);
  expect(recalculateHealthStatuses(next, rules)).toBe(next);
});
