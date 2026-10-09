import { formatStatusAction } from "@core/logging/formatStatusAction";
import { createEncounterState } from "@core/encounter/createEncounterState";
import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { createEncounterHistoryState } from "@core/history/types";
import { getAvailableCounterName } from "@core/entity_resources/counters";
import { prepareValidatedEncounterChange } from "@core/validation/validatedEncounterChange";
import { createZone, deleteZone } from "@entities/zone/zoneMutations";
import { clockCounters, removeZoneClock, removeZoneCounter, saveZoneClock, saveZoneCounter, updateZoneStatus, validZoneResources } from "@entities/zone/zoneStatus";
import { getExportableZoneProperties } from "@ui/panels/zone_properties/options";
import reducer, { commitEncounterChange, redoEncounterChange, undoEncounterChange } from "@store/encounterSlice";

function initialState() {
  return createZone(createEncounterState({ id: "zone-status", name: "Zone status" }), { id: "z", name: "Hall", polygon: [{ x: 20, y: 20 }, { x: 320, y: 20 }, { x: 320, y: 320 }, { x: 20, y: 320 }] });
}
const counter = { id: "c", name: "Charges", value: 2, minimum: 0, maximum: 3 };
const clock = { id: "k", name: "Alarm", value: 3, segments: 4 };

describe("Zone status resources", () => {
  it("restores every resource and Zone deletion exactly through undo/redo", () => {
    const initial = initialState();
    const created = updateZoneStatus(initial, "z", (zone) => ({ ...saveZoneClock(saveZoneCounter(zone, counter), clock), tags: ["danger"], notes: "  Watch guards\n" }));
    const edited = updateZoneStatus(created, "z", (zone) => saveZoneClock(saveZoneCounter(zone, { ...counter, maximum: 1 }), { ...clock, segments: 2 }));
    expect(edited.zones.byId.z.counters?.byId.c.value).toBe(1);
    expect(edited.zones.byId.z.clocks?.byId.k.value).toBe(2);
    const removed = updateZoneStatus(edited, "z", (zone) => removeZoneClock(removeZoneCounter(zone, "c"), "k"));
    const snapshots = [initial, created, edited, removed, deleteZone(removed, "z")];
    let history = createEncounterHistoryState(initial);
    for (const nextEncounter of snapshots.slice(1)) history = reducer(history, commitEncounterChange({ action: createEncounterActionRecord("zone.editClocks"), nextEncounter }));
    for (const expected of snapshots.slice(0, -1).reverse()) { history = reducer(history, undoEncounterChange()); expect(history.present).toEqual(expected); }
    for (const expected of snapshots.slice(1)) { history = reducer(history, redoEncounterChange()); expect(history.present).toEqual(expected); }
  });
  it("preserves identity for missing resources, identical edits, and bounded no-ops", () => {
    const state = updateZoneStatus(initialState(), "z", (zone) => saveZoneClock(saveZoneCounter(zone, counter), { ...clock, value: 4 }));
    expect(updateZoneStatus(state, "missing", (zone) => zone)).toBe(state);
    expect(updateZoneStatus(state, "z", (zone) => saveZoneCounter(zone, counter))).toBe(state);
    expect(updateZoneStatus(state, "z", (zone) => saveZoneClock(zone, { ...clock, value: 99 }))).toBe(state);
    expect(updateZoneStatus(state, "z", (zone) => removeZoneClock(removeZoneCounter(zone, "missing"), "missing"))).toBe(state);
    expect(clockCounters(state.zones.byId.z.clocks).byId.k).toEqual({ id: "k", name: "Alarm", value: 4, minimum: 0, maximum: 4, style: "traditional" });
    expect(state.zones.byId.z.clocks?.byId.k).not.toHaveProperty("maximum");
  });
  it.each([1, 5, 12])("accepts %s segments and clamps progress", (segments) => {
    const zone = saveZoneClock(initialState().zones.byId.z, { ...clock, segments, value: 99 });
    expect(zone.clocks?.byId.k.value).toBe(segments);
    expect(validZoneResources(zone)).toBe(true);
    expect(saveZoneClock(zone, { ...clock, segments, value: -2 }).clocks?.byId.k.value).toBe(0);
  });
  it.each([0, 13, 1.5, NaN])("rejects invalid segment count %s", (segments) => {
    expect(validZoneResources(saveZoneClock(initialState().zones.byId.z, { ...clock, segments }))).toBe(false);
  });
  it.each(["STRICT", "ADVISORY"] as const)("reports invalid clock/counter resources in %s", (mode) => {
    const state = { ...initialState(), validationState: { mode, messages: [] } };
    const next = updateZoneStatus(state, "z", (zone) => saveZoneClock(saveZoneCounter(zone, { ...counter, minimum: 5, maximum: 1 }), { ...clock, segments: 13 }));
    const prepared = prepareValidatedEncounterChange({ currentEncounter: state, nextEncounter: next, action: createEncounterActionRecord("zone.editClocks") });
    expect(prepared.blocked).toBe(mode === "STRICT");
    expect(prepared.validationResult.messages).toContainEqual(expect.objectContaining({ code: "zone.resourcesInvalid" }));
  });
  it.each(["traditional", "box", "stack", "row"] as const)("preserves %s style during bounded progress edits", (style) => {
    const initial = initialState();
    const styled = saveZoneClock(initial.zones.byId.z, { ...clock, style });
    expect(saveZoneClock(styled, { ...clock, style })).toBe(styled);
    expect(saveZoneClock(styled, { ...clock, style, value: 99 }).clocks?.byId.k).toMatchObject({ value: 4, segments: 4, style });
    expect(saveZoneClock(styled, { ...clock, style, value: -2 }).clocks?.byId.k).toMatchObject({ value: 0, segments: 4, style });
    const switched = saveZoneClock(styled, { ...clock, style: style === "traditional" ? "box" : "traditional" });
    expect(switched).not.toBe(styled); expect(switched.clocks?.byId.k.value).toBe(3);
  });
  it.each(["STRICT", "ADVISORY"] as const)("validates an invalid clock style in %s", (mode) => {
    const state = { ...initialState(), validationState: { mode, messages: [] } };
    const next = updateZoneStatus(state, "z", (zone) => saveZoneClock(zone, { ...clock, style: "unknown" as never }));
    expect(validZoneResources(next.zones.byId.z)).toBe(false);
    const prepared = prepareValidatedEncounterChange({ currentEncounter: state, nextEncounter: next, action: createEncounterActionRecord("zone.editClocks") });
    expect(prepared.blocked).toBe(mode === "STRICT");
    expect(prepared.validationResult.messages).toContainEqual(expect.objectContaining({ code: "zone.resourcesInvalid" }));
  });
  it("describes Zone status commands in readable action logs", () => {
    const state = initialState();
    for (const [type, label] of [["editClocks", "Updated clocks"], ["saveCounter", "Saved a counter"], ["setTags", "Updated tags"], ["setNotes", "Updated notes"]]) {
      expect(formatStatusAction(createEncounterActionRecord(`zone.${type}`, { zoneId: "z" }), { before: state, after: state })).toBe(`${label} for Hall.`);
    }
  });
  it("keeps names independent per owner and excludes status from property exports", () => {
    const zone = { ...saveZoneClock(saveZoneCounter(initialState().zones.byId.z, { ...counter, name: "Counter 1" }), { ...clock, name: "Clock 1" }), tags: ["hazard"], notes: "secret" };
    expect(getAvailableCounterName(zone.counters)).toBe("Counter 2");
    expect(getAvailableCounterName(clockCounters(zone.clocks), "Clock")).toBe("Clock 2");
    const exported = getExportableZoneProperties(zone);
    for (const key of ["tags", "notes", "clocks", "counters"]) expect(exported).not.toHaveProperty(key);
  });
});
