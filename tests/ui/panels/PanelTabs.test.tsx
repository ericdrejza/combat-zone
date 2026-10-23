import { act, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createEncounterState } from "@core/encounter/createEncounterState";
import { setActiveTool } from "@interaction/interactionState";
import { store } from "@store/store";
import { loadEncounterState, redoEncounterChange, undoEncounterChange } from "@store/encounterSlice";
import { setPersistenceWritable } from "@store/persistenceWriteGuardMiddleware";
import { renderApp } from "@tests/ui/renderApp";
import { INTERFACE_PREFERENCES_STORAGE_KEY } from "@ui/interface_preferences/InterfacePreferenceProvider";
import { actor, seedEncounter } from "./zoneless_actors/ZonelessActorPanel.test_support";

function setup(placement: "canvas" | "sidebar" = "sidebar") {
  localStorage.setItem(INTERFACE_PREFERENCES_STORAGE_KEY, JSON.stringify({ panelTabMode: true, zonelessPanelPlacement: placement }));
  renderApp();
  act(() => { store.dispatch(setActiveTool("actor")); });
  fireEvent.click(screen.getByRole("tab", { name: "Library panel" }));
}
const tab = (name: string) => screen.getByRole("tab", { name: `${name} panel` });
const pane = (name: string) => screen.getByRole("tabpanel", { name: `${name} panel` });
afterEach(() => { localStorage.removeItem(INTERFACE_PREFERENCES_STORAGE_KEY); setPersistenceWritable(true); });

it("shows one panel per sidebar and switches tabs without editing the encounter", async () => {
  setup();
  const user = userEvent.setup();
  const before = store.getState().encounter;
  expect(screen.getAllByRole("tabpanel")).toHaveLength(2);
  expect(tab("Library")).toHaveAttribute("aria-selected", "true");
  await user.click(tab("Log"));
  expect(pane("Log")).toBeInTheDocument();
  expect(pane("Initiative")).toBeInTheDocument();
  expect(screen.queryByRole("tabpanel", { name: "Library panel" })).not.toBeInTheDocument();
  expect(tab("Log")).toHaveAttribute("aria-selected", "true");
  expect(store.getState().encounter).toBe(before);
});

it("keeps footer tabs when collapsed and opens the clicked panel", async () => {
  setup();
  const user = userEvent.setup();
  const before = store.getState().encounter;
  await user.click(screen.getByRole("button", { name: "Collapse left sidebar" }));
  expect(tab("Log")).toHaveAttribute("aria-selected", "false");
  expect(screen.getByRole("tablist", { name: "left panel tabs" })).toBeInTheDocument();
  expect(screen.getByRole("separator", { name: "Panel tabs and sidebar controls" })).toBeInTheDocument();
  await user.click(tab("Log"));
  expect(pane("Log")).toBeInTheDocument();
  expect(tab("Log")).toHaveAttribute("aria-selected", "true");
  expect(screen.getByRole("button", { name: "Collapse left sidebar" })).toBeInTheDocument();
  expect(store.getState().encounter).toBe(before);
});

it("replaces the Zoneless overlay button with a working tab and grouping toggle", async () => {
  setup();
  const user = userEvent.setup();
  act(() => { seedEncounter([actor("a", "Aria")]); });
  expect(screen.queryByRole("button", { name: "Hide Zoneless panel" })).not.toBeInTheDocument();
  await user.click(tab("Zoneless"));
  const zoneless = pane("Zoneless");
  expect(within(zoneless).getByRole("button", { name: "Aria" })).toBeInTheDocument();
  const group = within(zoneless).getByRole("button", { name: "Group by faction" });
  expect(group).toHaveAttribute("aria-pressed", "true");
  await user.click(group);
  expect(group).toHaveAttribute("aria-pressed", "false");
  await user.click(tab("Log"));
  await user.click(tab("Zoneless"));
  expect(within(pane("Zoneless")).getByRole("button", { name: "Group by faction" })).toHaveAttribute("aria-pressed", "false");
});

it("supports keyboard tab switching and skips an unavailable Library", () => {
  setup();
  act(() => { store.dispatch(setActiveTool("zone")); });
  expect(tab("Library")).toHaveAttribute("aria-disabled", "true");
  fireEvent.click(tab("Library"));
  expect(tab("Library")).toHaveAttribute("aria-selected", "false");
  const properties = tab("Properties");
  properties.focus();
  fireEvent.keyDown(properties, { key: "ArrowRight" });
  expect(tab("Log")).toHaveFocus();
  expect(tab("Log")).toHaveAttribute("aria-selected", "true");
});

it.each(["ADVISORY", "STRICT"] as const)("moves footer tabs atomically with undo and redo in %s", mode => {
  setup();
  act(() => {
    const encounter = createEncounterState({ id: "tabs", name: "Tabs" });
    encounter.validationState.mode = mode;
    store.dispatch(loadEncounterState(encounter));
  });
  const before = store.getState().encounter.present;
  const dataTransfer = { effectAllowed: "", setData() {} };
  fireEvent.dragStart(tab("Log"), { dataTransfer });
  fireEvent.dragOver(screen.getByRole("tablist", { name: "right panel tabs" }), { dataTransfer });
  fireEvent.drop(screen.getByRole("tablist", { name: "right panel tabs" }), { dataTransfer });
  const after = store.getState().encounter.present;
  expect(after.panelLayout.left.map(panel => panel.id)).toEqual(["library", "properties", "zoneless"]);
  expect(after.panelLayout.right.at(-1)?.id).toBe("log");
  expect(after.validationState).toEqual(before.validationState);
  expect(store.getState().encounter.past).toHaveLength(1);
  act(() => { store.dispatch(undoEncounterChange()); });
  expect(store.getState().encounter.present).toEqual(before);
  act(() => { store.dispatch(redoEncounterChange()); });
  expect(store.getState().encounter.present).toEqual(after);
});

it("reorders collapsed tabs by pointer without treating the drag as a tab click", async () => {
  setup();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Collapse right sidebar" }));
  const target = tab("Status");
  target.getBoundingClientRect = () => ({ top: 100, height: 40, left: 0, width: 40 }) as DOMRect;
  const original = document.elementFromPoint;
  document.elementFromPoint = vi.fn(() => target);
  try {
    fireEvent.pointerDown(tab("Zoneless"), { button: 0, pointerId: 1, clientX: 10, clientY: 0 });
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 10, clientY: 135 });
    fireEvent.pointerUp(window, { pointerId: 1, clientX: 10, clientY: 135 });
    expect(store.getState().encounter.present.panelLayout.right.map(panel => panel.id))
      .toEqual(["initiative", "status", "zoneless", "audio"]);
    expect(screen.getByRole("button", { name: "Expand right sidebar" })).toBeInTheDocument();
  } finally { document.elementFromPoint = original; }
});

it("preserves history and order for return-to-canvas drops and read-only moves", () => {
  setup();
  const before = store.getState().encounter;
  const dataTransfer = { effectAllowed: "", setData() {} };
  fireEvent.dragStart(tab("Log"), { dataTransfer });
  fireEvent.dragOver(screen.getByRole("main", { name: "Encounter canvas" }), { dataTransfer });
  fireEvent.dragEnd(tab("Log"));
  expect(store.getState().encounter).toBe(before);
  setPersistenceWritable(false);
  fireEvent.dragStart(tab("Log"), { dataTransfer });
  fireEvent.drop(screen.getByRole("tablist", { name: "right panel tabs" }), { dataTransfer });
  expect(store.getState().encounter).toBe(before);
});

it("honors canvas placement in tab mode, retaining the visibility button instead of a Zoneless tab", async () => {
  setup("canvas");
  const user = userEvent.setup();
  expect(screen.queryByRole("tab", { name: "Zoneless panel" })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Hide Zoneless panel" }));
  expect(screen.getByRole("button", { name: "Show Zoneless panel" })).toBeInTheDocument();
  expect(screen.queryByRole("complementary", { name: "Zoneless actors" })).not.toBeInTheDocument();
});

it.each([true, false])("switches Zoneless between canvas and sidebar with Panel Tabs %s", tabMode => {
  localStorage.setItem(INTERFACE_PREFERENCES_STORAGE_KEY, JSON.stringify({ panelTabMode: tabMode, zonelessPanelPlacement: "canvas" }));
  renderApp();
  const before = store.getState().encounter;
  act(() => {
    localStorage.setItem(INTERFACE_PREFERENCES_STORAGE_KEY, JSON.stringify({ panelTabMode: tabMode, zonelessPanelPlacement: "sidebar" }));
    window.dispatchEvent(new StorageEvent("storage", { key: INTERFACE_PREFERENCES_STORAGE_KEY }));
  });
  expect(screen.queryByRole("button", { name: "Hide Zoneless panel" })).not.toBeInTheDocument();
  if (tabMode) fireEvent.click(tab("Zoneless"));
  expect(screen.getByRole("heading", { name: "Zoneless" })).toBeInTheDocument();
  expect(store.getState().encounter).toBe(before);
});

it("does not reorder a hidden canvas Zoneless panel or create history for an unchanged visible tab drop", () => {
  setup("canvas");
  const before = store.getState().encounter;
  const dataTransfer = { effectAllowed: "", setData() {} };
  fireEvent.dragStart(tab("Log"), { dataTransfer });
  fireEvent.drop(screen.getByRole("tablist", { name: "left panel tabs" }), { dataTransfer });
  expect(store.getState().encounter).toBe(before);
});

it("resets active tabs when changing encounters and loads fresh history", async () => {
  setup();
  const user = userEvent.setup();
  const original = store.getState().encounter.present;
  await user.click(tab("Log"));
  act(() => { store.dispatch(loadEncounterState(createEncounterState({ id: "other", name: "Other" }))); });
  expect(tab("Library")).toHaveAttribute("aria-selected", "true");
  act(() => { store.dispatch(loadEncounterState(original)); });
  expect(tab("Library")).toHaveAttribute("aria-selected", "true");
  expect(store.getState().encounter.past).toEqual([]);
  expect(store.getState().encounter.future).toEqual([]);
});

it("keeps the initially active panel selected when it is reordered within its own sidebar", () => {
  localStorage.setItem(INTERFACE_PREFERENCES_STORAGE_KEY, JSON.stringify({ panelTabMode: true, zonelessPanelPlacement: "sidebar" }));
  renderApp();
  const left = screen.getByRole("tablist", { name: "left panel tabs" });
  const source = within(left).getByRole("tab", { selected: true });
  const name = source.getAttribute("aria-label")!;
  const dataTransfer = { effectAllowed: "", setData() {} };
  fireEvent.dragStart(source, { dataTransfer });
  fireEvent.drop(left, { dataTransfer });
  expect(screen.getByRole("tab", { name })).toHaveAttribute("aria-selected", "true");
});

it("activates the next source tab while preserving the destination's active tab", async () => {
  setup();
  const user = userEvent.setup();
  await user.click(tab("Log"));
  const dataTransfer = { effectAllowed: "", setData() {} };
  fireEvent.dragStart(tab("Log"), { dataTransfer });
  fireEvent.drop(screen.getByRole("tablist", { name: "right panel tabs" }), { dataTransfer });
  expect(tab("Zoneless")).toHaveAttribute("aria-selected", "true");
  expect(tab("Initiative")).toHaveAttribute("aria-selected", "true");
  expect(tab("Log")).toHaveAttribute("aria-selected", "false");
});

it("activates the previous source tab when its last active tab moves away", async () => {
  setup("canvas");
  const user = userEvent.setup();
  await user.click(tab("Log"));
  const dataTransfer = { effectAllowed: "", setData() {} };
  fireEvent.dragStart(tab("Log"), { dataTransfer });
  fireEvent.drop(screen.getByRole("tablist", { name: "right panel tabs" }), { dataTransfer });
  expect(tab("Properties")).toHaveAttribute("aria-selected", "true");
  expect(tab("Initiative")).toHaveAttribute("aria-selected", "true");
});

it("activates the first tab moved into an empty sidebar", () => {
  setup();
  act(() => {
    const state = createEncounterState({ id: "empty-target", name: "Empty target" });
    state.panelLayout.left.push(...state.panelLayout.right);
    state.panelLayout.right = [];
    store.dispatch(loadEncounterState(state));
  });
  expect(screen.getByRole("tablist", { name: "right panel tabs" })).toHaveAttribute("aria-orientation", "vertical");
  const dataTransfer = { effectAllowed: "", setData() {} };
  fireEvent.dragStart(tab("Log"), { dataTransfer });
  fireEvent.drop(screen.getByRole("tablist", { name: "right panel tabs" }), { dataTransfer });
  expect(tab("Log")).toHaveAttribute("aria-selected", "true");
  expect(pane("Log")).toBeInTheDocument();
});

it("toggles the sidebar by clicking its active tab without changing history", async () => {
  setup();
  const user = userEvent.setup();
  const before = store.getState().encounter;
  expect(tab("Library")).toHaveAttribute("aria-selected", "true");
  await user.click(tab("Library"));
  expect(screen.getByRole("button", { name: "Expand left sidebar" })).toBeInTheDocument();
  expect(tab("Library")).toHaveAttribute("aria-selected", "false");
  await user.click(tab("Library"));
  expect(pane("Library")).toBeInTheDocument();
  expect(tab("Library")).toHaveAttribute("aria-selected", "true");
  fireEvent.keyDown(tab("Library"), { key: "Home" });
  expect(pane("Library")).toBeInTheDocument();
  expect(store.getState().encounter).toBe(before);
});
