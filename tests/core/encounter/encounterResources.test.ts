import { createEncounterState } from "@core/encounter/createEncounterState";
import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { createEncounterHistoryState } from "@core/history/types";
import { saveResourceClock, saveResourceCounter, removeResourceClock, removeResourceCounter } from "@core/entity_resources/statusResources";
import { prepareValidatedEncounterChange } from "@core/validation/validatedEncounterChange";
import { formatStatusAction } from "@core/logging/formatStatusAction";
import reducer, { commitEncounterChange, redoEncounterChange, undoEncounterChange } from "@store/encounterSlice";

const initial = () => createEncounterState({ id: "encounter", name: "Encounter" });
const counter = { id: "c", name: "Supplies", value: 3, minimum: 0, maximum: 5 };
const clock = { id: "k", name: "Alarm", value: 2, segments: 4, style: "box" as const };

it("restores encounter resources, clamping edits and removals exactly through history", () => {
  const start = initial();
  const created = saveResourceClock(saveResourceCounter(start, counter), clock);
  expect(saveResourceClock(created, clock)).toBe(created);
  expect(saveResourceCounter(created, counter)).toBe(created);
  const edited = saveResourceClock(saveResourceCounter(created, { ...counter, maximum: 1 }), { ...clock, segments: 1 });
  expect(edited.counters.byId.c.value).toBe(1);
  expect(edited.clocks.byId.k).toMatchObject({ value: 1, segments: 1, style: "box" });
  const removed = removeResourceClock(removeResourceCounter(edited, "c"), "k");
  const snapshots = [start, created, edited, removed];
  let history = createEncounterHistoryState(start);
  for (const nextEncounter of snapshots.slice(1)) history = reducer(history, commitEncounterChange({ action: createEncounterActionRecord("encounter.editClocks"), nextEncounter }));
  for (const expected of snapshots.slice(0, -1).reverse()) { history = reducer(history, undoEncounterChange()); expect(history.present).toEqual(expected); }
  for (const expected of snapshots.slice(1)) { history = reducer(history, redoEncounterChange()); expect(history.present).toEqual(expected); }
});

it.each(["STRICT", "ADVISORY"] as const)("validates invalid encounter resources in %s", (mode) => {
  const current = { ...initial(), validationState: { mode, messages: [] } };
  for (const next of [saveResourceClock(current, { ...clock, segments: 13 }), saveResourceClock(current, { ...clock, style: "bad" as never }), saveResourceCounter(current, { ...counter, name: " " })]) {
    const prepared = prepareValidatedEncounterChange({ currentEncounter: current, nextEncounter: next, action: createEncounterActionRecord("encounter.editClocks") });
    expect(prepared.blocked).toBe(mode === "STRICT");
    expect(prepared.validationResult.messages).toContainEqual(expect.objectContaining({ code: "encounter.resourcesInvalid" }));
  }
});

it("formats encounter status actions with the encounter name", () => {
  const state = initial();
  expect(formatStatusAction(createEncounterActionRecord("encounter.saveClock"), { before: state, after: state })).toBe("Saved a clock for Encounter.");
});
