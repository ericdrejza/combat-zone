import * as runtimeValidation from "@core/validation/runtimeEncounterChange";
import { prepareValidatedEncounterChange } from "@core/validation/validatedEncounterChange";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { createEncounterState } from "@core/encounter/createEncounterState";
import { createZone } from "@entities/zone/zoneMutations";
import { selectEntity } from "@interaction/interactionState";
import { loadEncounterState, undoEncounterChange, redoEncounterChange } from "@store/encounterSlice";
import { setPersistenceWritable } from "@store/persistenceWriteGuardMiddleware";
import { store } from "@store/store";
import { resetAppStore } from "@tests/ui/renderApp";
import { ZonePropertiesPanel } from "@ui/panels/ZonePropertiesPanel";
import { getPaintableZoneProperties } from "@ui/canvas/zones/zonePropertyTransfers";

function setup(mode: "STRICT" | "ADVISORY" = "ADVISORY") {
  setPersistenceWritable(true);
  resetAppStore();
  let state = createEncounterState({ id: "paint-test", name: "Paint" });
  for (const [index, id] of ["source", "target", "target-two", "unselected"].entries()) {
    const x = 50 + index * 200;
    state = createZone(state, { id, polygon: [{ x, y: 50 }, { x: x + 100, y: 50 }, { x: x + 100, y: 150 }, { x, y: 150 }],
      ...(index === 0 ? { colorFill: "#bfdbfe", colorBorder: "#ff0000", colorEngagement: "#00ff00",
        matchEngagementColorToBorder: false, showBorder: false, opacity: 0.2 } : {}) });
  }
  state = { ...state, validationState: { mode, messages: [] } };
  store.dispatch(loadEncounterState(state));
  store.dispatch(selectEntity({ entityType: "zone", ids: ["source", "target", "target-two"] }));
  render(<Provider store={store}><ZonePropertiesPanel /></Provider>);
}
const zones = () => store.getState().encounter.present.zones.byId;
const paint = () => fireEvent.click(screen.getByRole("button", { name: "Paint zone colors" }));
afterEach(() => { setPersistenceWritable(true); vi.restoreAllMocks(); });

describe("Painting selected Zones", () => {
  it("copies only colors to selected targets in one undoable action and keeps the brush active", async () => {
    setup();
    const before = zones();
    paint();
    await waitFor(() => expect(store.getState().encounter.past).toHaveLength(1));
    expect(getPaintableZoneProperties(zones().target)).toEqual(getPaintableZoneProperties(before.source));
    expect(getPaintableZoneProperties(zones()["target-two"])).toEqual(getPaintableZoneProperties(before.source));
    expect(zones().target.polygon).toEqual(before.target.polygon);
    expect(zones().target.name).toBe(before.target.name);
    expect(zones().source).toEqual(before.source);
    expect(zones().unselected).toEqual(before.unselected);
    expect(store.getState().interaction.zonePaintBrush).toEqual({ sourceZoneId: "source" });
    expect(store.getState().interaction.selection.selectedIds).toEqual(["source", "target", "target-two"]);
    const after = zones();
    act(() => { store.dispatch(undoEncounterChange()); });
    expect(zones()).toEqual(before);
    act(() => { store.dispatch(redoEncounterChange()); });
    expect(zones()).toEqual(after);
    paint();
    expect(store.getState().interaction.zonePaintBrush).toBeNull();
    expect(store.getState().encounter.past).toHaveLength(1);
  });

  it("does not create history when selected colors already match", async () => {
    setup();
    paint();
    await waitFor(() => expect(store.getState().encounter.past).toHaveLength(1));
    paint();
    paint();
    await act(async () => {});
    expect(store.getState().encounter.past).toHaveLength(1);
    expect(store.getState().interaction.zonePaintBrush).toEqual({ sourceZoneId: "source" });
  });

  it("does not activate or mutate in a read-only tab", () => {
    setup();
    setPersistenceWritable(false);
    paint();
    expect(store.getState().interaction.zonePaintBrush).toBeNull();
    expect(store.getState().encounter.past).toHaveLength(0);
  });
});

it.each(["STRICT", "ADVISORY"] as const)("validates the selected color batch atomically in %s mode", async mode => {
  setup(mode);
  const before = zones();
  vi.spyOn(runtimeValidation, "prepareValidatedEncounterChangeForRuntime").mockImplementation(input =>
    prepareValidatedEncounterChange({ ...input, validators: [{ id: "PaintConstraint", validate: () => ({
      valid: false, messages: [{ code: "paint.constraint", severity: "error", message: "Constraint" }]
    }) }] }));
  paint();
  await act(async () => {});
  expect(store.getState().encounter.past).toHaveLength(mode === "STRICT" ? 0 : 1);
  if (mode === "STRICT") expect(zones()).toEqual(before);
  else expect(getPaintableZoneProperties(zones().target)).toEqual(getPaintableZoneProperties(before.source));
});

it("discards delayed painting after the encounter changes", async () => {
  setup();
  let resolve!: (value: ReturnType<typeof prepareValidatedEncounterChange>) => void;
  const pending = new Promise<ReturnType<typeof prepareValidatedEncounterChange>>(done => { resolve = done; });
  let prepared!: ReturnType<typeof prepareValidatedEncounterChange>;
  vi.spyOn(runtimeValidation, "prepareValidatedEncounterChangeForRuntime").mockImplementation(input => {
    prepared = prepareValidatedEncounterChange(input); return pending;
  });
  const before = zones();
  paint();
  act(() => { store.dispatch(loadEncounterState({ ...store.getState().encounter.present, name: "Updated" })); });
  await act(async () => { resolve(prepared); await pending; });
  expect(zones()).toEqual(before);
  expect(store.getState().encounter.past).toHaveLength(0);
});
