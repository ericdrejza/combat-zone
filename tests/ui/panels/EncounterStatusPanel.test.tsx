import { PersistenceContext } from "@ui/persistence/PersistenceContext";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { createEncounterState } from "@core/encounter/createEncounterState";
import { createZone } from "@entities/zone/zoneMutations";
import { selectEntity, clearSelection } from "@interaction/interactionState";
import { loadEncounterState, undoEncounterChange, redoEncounterChange } from "@store/encounterSlice";
import { setPersistenceWritable } from "@store/persistenceWriteGuardMiddleware";
import { store } from "@store/store";
import { resetAppStore } from "@tests/ui/renderApp";
import { StatusPanel } from "@ui/panels/StatusPanel";
import { InterfacePreferenceProvider, INTERFACE_PREFERENCES_STORAGE_KEY } from "@ui/interface_preferences/InterfacePreferenceProvider";

function setup(readOnly = false) {
  resetAppStore();
  store.dispatch(loadEncounterState(createZone(createEncounterState({ id: "encounter", name: "Night watch" }), { id: "z", name: "Hall", polygon: [{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 300 }, { x: 0, y: 300 }] })));
  return render(<Provider store={store}><PersistenceContext.Consumer>{(context) => <PersistenceContext.Provider value={{ ...context, readOnly }}><InterfacePreferenceProvider><StatusPanel /></InterfacePreferenceProvider></PersistenceContext.Provider>}</PersistenceContext.Consumer></Provider>);
}
const state = () => store.getState().encounter.present;
async function addClock() {
  fireEvent.click(screen.getByRole("button", { name: "Add clock" }));
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(state().clocks.allIds).toHaveLength(1));
}
afterEach(() => { setPersistenceWritable(true); localStorage.removeItem(INTERFACE_PREFERENCES_STORAGE_KEY); });

it("shows encounter scope with no selection, and keeps Zone resources independent", async () => {
  setup();
  expect(screen.getByLabelText("Encounter status")).toBeInTheDocument();
  expect(screen.getByLabelText("Encounter name")).toHaveTextContent("Night watch");
  await addClock();
  act(() => store.dispatch(selectEntity({ entityType: "zone", ids: ["z"] })));
  expect(screen.getByLabelText("Zone status")).toBeInTheDocument();
  expect(screen.queryByRole("img", { name: /Clock 1:/ })).not.toBeInTheDocument();
  expect(state().zones.byId.z.clocks?.allIds ?? []).toHaveLength(0);
  act(() => store.dispatch(clearSelection()));
  expect(screen.getByRole("img", { name: "Clock 1: 0 of 4 segments filled" })).toBeInTheDocument();
});

it("creates bounded counters and restores changes through undo/redo", async () => {
  setup();
  fireEvent.click(screen.getByRole("button", { name: "Add counter" }));
  fireEvent.change(screen.getByLabelText("Maximum (optional)"), { target: { value: "1" } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(state().counters.allIds).toHaveLength(1));
  fireEvent.click(screen.getByRole("button", { name: "Increase Counter 1" }));
  await waitFor(() => expect(state().counters.byId[state().counters.allIds[0]].value).toBe(1));
  expect(screen.getByRole("button", { name: "Increase Counter 1" })).toBeDisabled();
  act(() => store.dispatch(undoEncounterChange()));
  expect(state().counters.byId[state().counters.allIds[0]].value).toBe(0);
  act(() => store.dispatch(redoEncounterChange()));
  expect(state().counters.byId[state().counters.allIds[0]].value).toBe(1);
});

it("uses default clock style, rebases quick steps, and confirms fill/reset", async () => {
  localStorage.setItem(INTERFACE_PREFERENCES_STORAGE_KEY, JSON.stringify({ clockStyleDefault: "box" }));
  setup(); await addClock();
  const clock = () => state().clocks.byId[state().clocks.allIds[0]];
  expect(clock()).toMatchObject({ segments: 4, style: "box", value: 0 });
  const increase = screen.getByRole("button", { name: "Increase Clock 1" });
  fireEvent.click(increase); fireEvent.click(increase);
  await waitFor(() => expect(clock().value).toBe(2));
  fireEvent.click(screen.getByRole("button", { name: "Reset Clock 1 to maximum" }));
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(clock().value).toBe(2);
  fireEvent.click(screen.getByRole("button", { name: "Reset Clock 1 to maximum" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
  await waitFor(() => expect(clock().value).toBe(4));
  fireEvent.click(screen.getByRole("button", { name: "Reset Clock 1 to zero" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
  await waitFor(() => expect(clock().value).toBe(0));
  act(() => store.dispatch(undoEncounterChange())); expect(clock().value).toBe(4);
  act(() => store.dispatch(redoEncounterChange())); expect(clock().value).toBe(0);
});

it.each(["box", "stack", "row"])("saves %s clock edits and removals atomically", async (style) => {
  setup(); await addClock();
  fireEvent.click(screen.getByRole("button", { name: "Edit clocks" }));
  fireEvent.change(screen.getByLabelText("Clock name"), { target: { value: "Alarm" } });
  fireEvent.change(screen.getByLabelText("Clock style"), { target: { value: style } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(Object.values(state().clocks.byId)[0]).toMatchObject({ name: "Alarm", style }));
  const edited = structuredClone(state().clocks);
  act(() => store.dispatch(undoEncounterChange()));
  expect(Object.values(state().clocks.byId)[0]).toMatchObject({ name: "Clock 1", style: "traditional", value: 0, segments: 4 });
  act(() => store.dispatch(redoEncounterChange())); expect(state().clocks).toEqual(edited);
  fireEvent.click(screen.getByRole("button", { name: "Edit clocks" }));
  fireEvent.click(screen.getByRole("button", { name: "Remove clock" }));
  expect(state().clocks.allIds).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(state().clocks.allIds).toHaveLength(0));
  act(() => store.dispatch(undoEncounterChange())); expect(Object.values(state().clocks.byId)[0].name).toBe("Alarm");
});

it("blocks writes when writer access is lost and cancels pending edits on navigation", async () => {
  setup(); await addClock();
  const before = state();
  setPersistenceWritable(false);
  fireEvent.click(screen.getByRole("button", { name: "Increase Clock 1" }));
  await act(async () => {}); expect(state()).toBe(before);
  setPersistenceWritable(true);
  fireEvent.click(screen.getByRole("button", { name: "Increase Clock 1" }));
  act(() => store.dispatch(loadEncounterState(createEncounterState({ id: "other", name: "Other" }))));
  await act(async () => {});
  expect(state().clocks.allIds).toHaveLength(0);
  expect(store.getState().encounter.past).toHaveLength(0);
});

it("disables encounter resource creation and editing in read-only sessions", () => {
  setup(true);
  for (const button of screen.getAllByRole("button")) expect(button).toBeDisabled();
  expect(store.getState().encounter.past).toHaveLength(0);
});

it("deletes only the clock on its card and restores it exactly through undo/redo", async () => {
  setup(); await addClock();
  fireEvent.click(screen.getByRole("button", { name: "Add clock" }));
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(state().clocks.allIds).toHaveLength(2));
  const before = structuredClone(state().clocks);
  const history = store.getState().encounter.past.length;
  fireEvent.click(screen.getByRole("button", { name: "Delete Clock 1 clock" }));
  await waitFor(() => expect(state().clocks.allIds).toHaveLength(1));
  expect(Object.values(state().clocks.byId)[0].name).toBe("Clock 2");
  expect(store.getState().encounter.past).toHaveLength(history + 1);
  act(() => store.dispatch(undoEncounterChange())); expect(state().clocks).toEqual(before);
  act(() => store.dispatch(redoEncounterChange())); expect(state().clocks.allIds).toHaveLength(1);
});

it("blocks clock-card deletion when writer access is lost", async () => {
  setup(); await addClock();
  const before = state();
  setPersistenceWritable(false);
  fireEvent.click(screen.getByRole("button", { name: "Delete Clock 1 clock" }));
  await act(async () => {});
  expect(state()).toBe(before);
});

it("opens the card's clock in the shared editor and saves only that clock with history", async () => {
  setup(); await addClock();
  fireEvent.click(screen.getByRole("button", { name: "Add clock" }));
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(state().clocks.allIds).toHaveLength(2));
  const before = structuredClone(state().clocks);
  const secondId = before.allIds[1];
  fireEvent.click(screen.getByRole("button", { name: "Edit Clock 2 clock" }));
  expect(screen.getByRole("dialog", { name: "Edit clocks" })).toBeInTheDocument();
  expect(screen.getByRole("combobox", { name: "Clock to edit" })).toHaveValue(secondId);
  expect(screen.getByLabelText("Clock name")).toHaveValue("Clock 2");
  fireEvent.change(screen.getByLabelText("Clock name"), { target: { value: "Alarm" } });
  expect(state().clocks).toEqual(before);
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(state().clocks.byId[secondId].name).toBe("Alarm"));
  expect(state().clocks.byId[before.allIds[0]]).toEqual(before.byId[before.allIds[0]]);
  act(() => store.dispatch(undoEncounterChange())); expect(state().clocks).toEqual(before);
  act(() => store.dispatch(redoEncounterChange())); expect(state().clocks.byId[secondId].name).toBe("Alarm");
  fireEvent.click(screen.getByRole("button", { name: "Edit clocks" }));
  expect(screen.getByRole("combobox", { name: "Clock to edit" })).toHaveValue(before.allIds[0]);
});
