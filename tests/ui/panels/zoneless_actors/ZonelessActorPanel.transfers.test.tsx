import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, vi } from "vitest";
import { setActiveTool } from "@interaction/interactionState";
import { loadEncounterState, redoEncounterChange, undoEncounterChange } from "@store/encounterSlice";
import { setPersistenceWritable } from "@store/persistenceWriteGuardMiddleware";
import { store } from "@store/store";
import { getCanvas, mockCanvasBounds, renderApp } from "@tests/ui/renderApp";
import { actor, seedEncounter, zone, dataTransfer, dropOnCanvas } from "./ZonelessActorPanel.test_support";
import { ZONELESS_ACTOR_DRAG_TYPE } from "@ui/panels/zoneless_actors/zonelessActorDrag";

async function setup(spatial = false, snap = false) {
  renderApp();
  act(() => {
    seedEncounter([actor("a", "Aria"), actor("b", "Borin")], [zone()]);
    const state = store.getState().encounter.present;
    store.dispatch(loadEncounterState({ ...state, movementRules: { ...state.movementRules,
      zoneLocked: !spatial, snapToGrid: snap, allowOverlap: false } }));
    store.dispatch(setActiveTool("actor"));
  });
  const canvas = getCanvas();
  mockCanvasBounds(canvas);
  await userEvent.setup().click(screen.getByRole("button", { name: "Expand zoneless actors" }));
  return canvas;
}

function start(pointerType: string) {
  fireEvent.pointerDown(screen.getByRole("button", { name: "Aria" }), { button: 0, pointerId: 8, pointerType, clientX: 400, clientY: 300 });
  fireEvent.pointerMove(window, { pointerId: 8, pointerType, clientX: 420, clientY: 300 });
}

afterEach(() => { vi.restoreAllMocks(); setPersistenceWritable(true); });

it.each(["mouse", "touch", "pen"])("retains internal and leave-and-return %s drops without history", async pointerType => {
  await setup(true);
  fireEvent.click(screen.getByRole("button", { name: "Select all Hero Zoneless actors" }));
  const before = store.getState().encounter;
  const panel = screen.getByRole("complementary", { name: "Zoneless actors" });
  start(pointerType);
  const preview = screen.getByRole("status", { name: "Dragging 2 actors" });
  expect(preview.parentElement).toBe(document.body);
  fireEvent.pointerMove(window, { pointerId: 8, clientX: 100, clientY: 100, pointerType });
  fireEvent.pointerUp(panel, { pointerId: 8, clientX: 420, clientY: 300, pointerType });
  expect(store.getState().encounter).toBe(before);
  expect(store.getState().interaction.selection.selectedIds).toEqual(["a", "b"]);
  fireEvent.click(screen.getByRole("button", { name: "Aria" }));
  expect(store.getState().interaction.selection.selectedIds).toEqual(["a", "b"]);
  expect(screen.queryByRole("status", { name: "Dragging 2 actors" })).not.toBeInTheDocument();
});

it.each([false, true])("places a faction group atomically with exact undo/redo (snapped=%s)", async snap => {
  const canvas = await setup(true, snap);
  fireEvent.click(screen.getByRole("button", { name: "Select all Hero Zoneless actors" }));
  const before = store.getState().encounter.present;
  start("mouse");
  fireEvent.pointerUp(canvas, { pointerId: 8, clientX: 450, clientY: 300, pointerType: "mouse" });
  await waitFor(() => expect(store.getState().encounter.past).toHaveLength(1));
  const after = store.getState().encounter.present;
  expect(after.actors.byId.a.spatialPosition).toBeDefined();
  expect(after.actors.byId.b.spatialPosition).not.toEqual(after.actors.byId.a.spatialPosition);
  act(() => { store.dispatch(undoEncounterChange()); });
  expect(store.getState().encounter.present).toEqual(before);
  act(() => { store.dispatch(redoEncounterChange()); });
  expect(store.getState().encounter.present).toEqual(after);
});

it("shares unsnapped group placement with native drops", async () => {
  const canvas = await setup(true);
  const transfer = dataTransfer();
  transfer.setData(ZONELESS_ACTOR_DRAG_TYPE, "a,b");
  dropOnCanvas(canvas, transfer, 450, 300);
  await waitFor(() => expect(store.getState().encounter.past).toHaveLength(1));
  const { a, b } = store.getState().encounter.present.actors.byId;
  expect(a.spatialPosition).not.toEqual(b.spatialPosition);
});

it.each(["pointercancel", "Escape", "outside", "read-only"])("creates no history on %s", async reason => {
  await setup(true);
  const before = store.getState().encounter;
  start("pen");
  if (reason === "read-only") setPersistenceWritable(false);
  if (reason === "Escape") fireEvent.keyDown(window, { key: "Escape" });
  else if (reason === "pointercancel") fireEvent.pointerCancel(window, { pointerId: 8 });
  else fireEvent.pointerUp(window, { pointerId: 8, clientX: reason === "outside" ? -10 : 450, clientY: 300 });
  expect(store.getState().encounter).toBe(before);
});

it("rejects an unsnapped group atomically when the canvas cannot fit it", async () => {
  const canvas = await setup(true);
  act(() => {
    const state = store.getState().encounter.present;
    store.dispatch(loadEncounterState({ ...state, zones: { allIds: [], byId: {} }, canvasSize: { width: 70, height: 70 } }));
  });
  const before = store.getState().encounter;
  fireEvent.click(screen.getByRole("button", { name: "Select all Zoneless actors" }));
  start("mouse");
  fireEvent.pointerUp(canvas, { pointerId: 8, clientX: 35, clientY: 35 });
  expect(store.getState().encounter).toBe(before);
});

it.each(["OFF", "ADVISORY", "ASSISTED", "STRICT"] as const)("accepts valid group placement in %s", async mode => {
  const canvas = await setup(true);
  act(() => {
    const state = store.getState().encounter.present;
    store.dispatch(loadEncounterState({ ...state, validationState: { mode, messages: [] } }));
  });
  fireEvent.click(screen.getByRole("button", { name: "Select all Zoneless actors" }));
  start("mouse");
  fireEvent.pointerUp(canvas, { pointerId: 8, clientX: 450, clientY: 300 });
  await waitFor(() => expect(store.getState().encounter.past).toHaveLength(1));
  expect(store.getState().encounter.present.actors.byId.b.spatialPosition).toBeDefined();
});

it.each(["ADVISORY", "STRICT"] as const)("preserves mode-specific validation for group drops in %s", async mode => {
  const canvas = await setup(true);
  act(() => {
    const state = store.getState().encounter.present;
    store.dispatch(loadEncounterState({ ...state,
      // A non-geometric integrity error demonstrates the existing mode boundary.
      actors: { ...state.actors, allIds: [...state.actors.allIds, "orphan"], byId: {
        ...state.actors.byId, orphan: { ...actor("orphan", "Orphan"), currentZoneId: "missing-zone", spatialPosition: { x: 800, y: 500 } }
      } }, validationState: { mode, messages: [] } }));
  });
  const before = store.getState().encounter.present;
  fireEvent.click(screen.getByRole("button", { name: "Select all Hero Zoneless actors" }));
  start("mouse");
  fireEvent.pointerUp(canvas, { pointerId: 8, clientX: 450, clientY: 300 });
  if (mode === "STRICT") {
    expect(store.getState().encounter.present).toBe(before);
    expect(store.getState().encounter.past).toHaveLength(0);
    expect(store.getState().encounterLog.entries.some(entry => entry.kind === "validation-block")).toBe(true);
  } else {
    await waitFor(() => expect(store.getState().encounter.past).toHaveLength(1));
  }
});

it("cancels a transfer when a newer encounter snapshot replaces its source", async () => {
  const canvas = await setup(true);
  start("mouse");
  act(() => {
    const state = store.getState().encounter.present;
    store.dispatch(loadEncounterState({ ...state, name: "Newer snapshot" }));
  });
  const before = store.getState().encounter;
  fireEvent.pointerUp(canvas, { pointerId: 8, clientX: 450, clientY: 300 });
  expect(store.getState().encounter).toBe(before);
});

it("preserves shared unsnapped positions when Overlap is enabled", async () => {
  const canvas = await setup(true);
  act(() => {
    const state = store.getState().encounter.present;
    store.dispatch(loadEncounterState({ ...state, movementRules: { ...state.movementRules, allowOverlap: true } }));
  });
  fireEvent.click(screen.getByRole("button", { name: "Select all Zoneless actors" }));
  start("mouse");
  fireEvent.pointerUp(canvas, { pointerId: 8, clientX: 450, clientY: 300 });
  await waitFor(() => expect(store.getState().encounter.past).toHaveLength(1));
  const { a, b } = store.getState().encounter.present.actors.byId;
  expect(a.spatialPosition).toEqual(b.spatialPosition);
});

it("keeps a native panel-to-panel drop unchanged", async () => {
  await setup(true);
  const transfer = dataTransfer();
  transfer.setData(ZONELESS_ACTOR_DRAG_TYPE, "a,b");
  const before = store.getState().encounter;
  fireEvent.drop(screen.getByRole("complementary", { name: "Zoneless actors" }), { dataTransfer: transfer });
  expect(store.getState().encounter).toBe(before);
});
