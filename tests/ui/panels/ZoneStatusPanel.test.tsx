import { InterfacePreferenceProvider, INTERFACE_PREFERENCES_STORAGE_KEY } from "@ui/interface_preferences/InterfacePreferenceProvider";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Provider } from "react-redux";
import { createEncounterState } from "@core/encounter/createEncounterState";
import { createZone } from "@entities/zone/zoneMutations";
import { selectEntity } from "@interaction/interactionState";
import { loadEncounterState, redoEncounterChange, undoEncounterChange } from "@store/encounterSlice";
import { setPersistenceWritable } from "@store/persistenceWriteGuardMiddleware";
import { store } from "@store/store";
import { resetAppStore } from "@tests/ui/renderApp";
import { StatusPanel } from "@ui/panels/StatusPanel";
import { PersistenceContext } from "@ui/persistence/PersistenceContext";

function setup(ids = ["z"], readOnly = false, configured = false) {
  setPersistenceWritable(true);
  resetAppStore();
  const state = createZone(createEncounterState({ id: "zone-ui", name: "Status" }), { id: "z", name: "Hall", polygon: [{ x: 20, y: 20 }, { x: 320, y: 20 }, { x: 320, y: 320 }, { x: 20, y: 320 }] });
  if (configured) Object.assign(state.zones.byId.z, {
    counters: { allIds: ["c"], byId: { c: { id: "c", name: "Charges", value: 1, maximum: 3 } } },
    clocks: { allIds: ["k"], byId: { k: { id: "k", name: "Alarm", value: 1, segments: 4 } } },
    tags: ["hazard"], notes: "secret"
  });
  store.dispatch(loadEncounterState(state));
  store.dispatch(selectEntity({ entityType: "zone", ids }));
  return render(<Provider store={store}><PersistenceContext.Consumer>{(context) => <PersistenceContext.Provider value={{ ...context, readOnly }}><InterfacePreferenceProvider><StatusPanel /></InterfacePreferenceProvider></PersistenceContext.Provider>}</PersistenceContext.Consumer></Provider>);
}
const zone = () => store.getState().encounter.present.zones.byId.z;
const clocks = () => Object.values(zone().clocks!.byId);
async function addClock() {
  fireEvent.click(screen.getByRole("button", { name: "Add clock" }));
  expect(screen.getByLabelText("Segments (1–12)")).toHaveValue(4);
  expect(screen.getByLabelText("Clock name")).toHaveAttribute("placeholder", "Clock 1");
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(clocks()).toHaveLength(1));
}
afterEach(() => { setPersistenceWritable(true); localStorage.removeItem(INTERFACE_PREFERENCES_STORAGE_KEY); });

describe("Zone Status panel", () => {
  it("shows a read-only name and all sections, requiring one Zone", () => {
    setup();
    expect(screen.getByLabelText("Selected zone name")).toHaveTextContent("Hall");
    expect(screen.getByLabelText("Counters")).toBeInTheDocument();
    expect(screen.getByLabelText("Clocks")).toBeInTheDocument();
    expect(screen.getByLabelText("Add zone tag")).toBeInTheDocument();
    expect(screen.getByLabelText("Notes")).toBeInTheDocument();
    act(() => store.dispatch(selectEntity({ entityType: "zone", ids: ["z", "other"] })));
    expect(screen.getByText("Select one zone to view status.")).toBeInTheDocument();
  });
  it("adds trimmed pills, prevents duplicates, and rebases notes through history", async () => {
    setup();
    const input = screen.getByLabelText("Add zone tag");
    fireEvent.change(input, { target: { value: "  hazard  " } }); fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(zone().tags).toEqual(["hazard"]));
    fireEvent.change(input, { target: { value: "hazard" } }); fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.change(input, { target: { value: "  " } }); fireEvent.keyDown(input, { key: "Enter" });
    expect(store.getState().encounter.past).toHaveLength(1);
    const notes = screen.getByLabelText("Notes");
    fireEvent.change(notes, { target: { value: "  Secret\nexit " } }); fireEvent.blur(notes);
    await waitFor(() => expect(zone().notes).toBe("  Secret\nexit "));
    act(() => store.dispatch(undoEncounterChange()));
    expect(notes).toHaveValue("");
    act(() => store.dispatch(redoEncounterChange()));
    expect(notes).toHaveValue("  Secret\nexit ");
    fireEvent.blur(notes); expect(store.getState().encounter.past).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Remove tag hazard" }));
    await waitFor(() => expect(zone().tags).toEqual([]));
    act(() => store.dispatch(undoEncounterChange()));
    expect(screen.getByRole("button", { name: "Remove tag hazard" })).toBeInTheDocument();
  });
  it("retains consecutive tag additions queued before validation settles", async () => {
    setup();
    const input = screen.getByLabelText("Add zone tag");
    fireEvent.change(input, { target: { value: "first" } }); fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.change(input, { target: { value: "second" } }); fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(zone().tags).toEqual(["first", "second"]));
    expect(store.getState().encounter.past).toHaveLength(2);
  });
  it("uses shared counter creation, bounds, and undo/redo", async () => {
    setup(); fireEvent.click(screen.getByRole("button", { name: "Add counter" }));
    fireEvent.change(screen.getByLabelText("Maximum (optional)"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(zone().counters!.allIds).toHaveLength(1));
    fireEvent.click(screen.getByRole("button", { name: "Increase Counter 1" }));
    await waitFor(() => expect(Object.values(zone().counters!.byId)[0].value).toBe(1));
    act(() => store.dispatch(undoEncounterChange()));
    expect(Object.values(zone().counters!.byId)[0].value).toBe(0);
    act(() => store.dispatch(redoEncounterChange()));
    expect(Object.values(zone().counters!.byId)[0].value).toBe(1);
  });
  it("creates clocks, rebases rapid steps, confirms filling, and clamps inline values", async () => {
    setup(); await addClock();
    expect(clocks()[0]).toMatchObject({ name: "Clock 1", value: 0, segments: 4 });
    expect(screen.getByRole("img", { name: "Clock 1: 0 of 4 segments filled" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Decrease Clock 1" })).toBeDisabled();
    const increase = screen.getByRole("button", { name: "Increase Clock 1" });
    fireEvent.click(increase); fireEvent.click(increase);
    await waitFor(() => expect(clocks()[0].value).toBe(2));
    fireEvent.click(screen.getByRole("button", { name: "Reset Clock 1 to maximum" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(clocks()[0].value).toBe(2);
    fireEvent.click(screen.getByRole("button", { name: "Reset Clock 1 to maximum" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(clocks()[0].value).toBe(4));
    expect(screen.getByRole("button", { name: "Increase Clock 1" })).toBeDisabled();
    act(() => store.dispatch(undoEncounterChange())); expect(clocks()[0].value).toBe(2);
    act(() => store.dispatch(redoEncounterChange())); expect(clocks()[0].value).toBe(4);
    const history = store.getState().encounter.past.length;
    fireEvent.click(screen.getByRole("button", { name: "Edit Clock 1 value" }));
    const current = screen.getByRole("textbox", { name: "Edit Clock 1 value" });
    fireEvent.change(current, { target: { value: "99" } }); fireEvent.blur(current);
    await act(async () => {});
    expect(clocks()[0].value).toBe(4); expect(store.getState().encounter.past).toHaveLength(history);
  });
  it.each(["traditional", "box", "stack", "row"])("confirms resetting a full %s clock to zero, with cancellation and exact history", async (style) => {
    localStorage.setItem(INTERFACE_PREFERENCES_STORAGE_KEY, JSON.stringify({ clockStyleDefault: style }));
    setup(); await addClock();
    fireEvent.click(screen.getByRole("button", { name: "Reset Clock 1 to maximum" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(clocks()[0].value).toBe(4));
    const history = store.getState().encounter.past.length;
    const open = () => fireEvent.click(screen.getByRole("button", { name: "Reset Clock 1 to zero" }));
    open();
    expect(screen.getByText("Reset Clock 1 to zero?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    open(); fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    open(); fireEvent.click(screen.getByRole("dialog").parentElement!);
    expect(clocks()[0].value).toBe(4); expect(store.getState().encounter.past).toHaveLength(history);
    open(); fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(clocks()[0]).toMatchObject({ value: 0, segments: 4, style }));
    expect(store.getState().encounter.past).toHaveLength(history + 1);
    expect(screen.getByRole("button", { name: "Reset Clock 1 to maximum" })).toBeInTheDocument();
    act(() => store.dispatch(undoEncounterChange()));
    expect(clocks()[0]).toMatchObject({ value: 4, segments: 4, style });
    act(() => store.dispatch(redoEncounterChange()));
    expect(clocks()[0]).toMatchObject({ value: 0, segments: 4, style });
  });
  it("blocks a confirmed full-clock reset if writer access is lost", async () => {
    setup(); await addClock();
    fireEvent.click(screen.getByRole("button", { name: "Reset Clock 1 to maximum" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(clocks()[0].value).toBe(4));
    const history = store.getState().encounter.past.length;
    fireEvent.click(screen.getByRole("button", { name: "Reset Clock 1 to zero" }));
    setPersistenceWritable(false);
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await act(async () => {});
    expect(clocks()[0].value).toBe(4); expect(store.getState().encounter.past).toHaveLength(history);
  });
  it("keeps clock drafts across selection, validates segments, and saves all edits atomically", async () => {
    setup(); await addClock();
    fireEvent.click(screen.getByRole("button", { name: "Edit clocks" }));
    fireEvent.change(screen.getByLabelText("Clock name"), { target: { value: "Alarm" } });
    fireEvent.change(screen.getByLabelText("Clock to edit"), { target: { value: "" } });
    expect(screen.getByLabelText("Clock name")).toHaveAttribute("placeholder", "Clock 1");
    fireEvent.change(screen.getByLabelText("Segments (1–12)"), { target: { value: "13" } });
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    const dialog = screen.getByRole("dialog", { name: "Unsaved clock changes" });
    expect(within(dialog).getByRole("button", { name: "Save changes" })).toBeDisabled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Keep editing" }));
    fireEvent.change(screen.getByLabelText("Segments (1–12)"), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText("Clock to edit"), { target: { value: clocks()[0].id } });
    expect(screen.getByLabelText("Clock name")).toHaveValue("Alarm");
    const history = store.getState().encounter.past.length;
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(clocks()).toHaveLength(2));
    expect(clocks().map(({ name, segments }) => ({ name, segments }))).toEqual([{ name: "Alarm", segments: 4 }, { name: "Clock 1", segments: 5 }]);
    expect(store.getState().encounter.past).toHaveLength(history + 1);
    act(() => store.dispatch(undoEncounterChange())); expect(clocks()).toHaveLength(1); expect(clocks()[0].name).toBe("Clock 1");
    act(() => store.dispatch(redoEncounterChange())); expect(clocks()).toHaveLength(2);
  });
  it("edits clock style in the shared draft and restores style and progress through history", async () => {
    setup(); await addClock();
    expect(clocks()[0].style).toBe("traditional");
    fireEvent.click(screen.getByRole("button", { name: "Edit clocks" }));
    fireEvent.change(screen.getByLabelText("Clock style"), { target: { value: "box" } });
    expect(clocks()[0].style).toBe("traditional");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(clocks()[0].style).toBe("box"));
    expect(screen.getByRole("img", { name: "Clock 1: 0 of 4 segments filled" }).querySelectorAll("rect")).toHaveLength(4);
    fireEvent.click(screen.getByRole("button", { name: "Increase Clock 1" }));
    await waitFor(() => expect(clocks()[0].value).toBe(1));
    expect(clocks()[0].style).toBe("box");
    act(() => store.dispatch(undoEncounterChange()));
    expect(clocks()[0]).toMatchObject({ style: "box", value: 0, segments: 4 });
    act(() => store.dispatch(undoEncounterChange()));
    expect(clocks()[0]).toMatchObject({ style: "traditional", value: 0, segments: 4 });
    act(() => store.dispatch(redoEncounterChange()));
    expect(clocks()[0]).toMatchObject({ style: "box", value: 0, segments: 4 });
    fireEvent.click(screen.getByRole("button", { name: "Edit clocks" }));
    fireEvent.change(screen.getByLabelText("Clock style"), { target: { value: "traditional" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(clocks()[0].style).toBe("box");
  });
  it("uses Interface defaults for new clocks through both creation paths without changing existing clocks", async () => {
    localStorage.setItem(INTERFACE_PREFERENCES_STORAGE_KEY, JSON.stringify({ clockStyleDefault: "box" }));
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Add clock" }));
    expect(screen.getByLabelText("Clock style")).toHaveValue("box");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(clocks()).toHaveLength(1));
    expect(clocks()[0].style).toBe("box");
    localStorage.setItem(INTERFACE_PREFERENCES_STORAGE_KEY, JSON.stringify({ clockStyleDefault: "traditional" }));
    act(() => window.dispatchEvent(new StorageEvent("storage", { key: INTERFACE_PREFERENCES_STORAGE_KEY })));
    expect(clocks()[0].style).toBe("box");
    fireEvent.click(screen.getByRole("button", { name: "Edit clocks" }));
    expect(screen.getByLabelText("Clock style")).toHaveValue("box");
    fireEvent.change(screen.getByLabelText("Clock to edit"), { target: { value: "" } });
    expect(screen.getByLabelText("Clock style")).toHaveValue("traditional");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(clocks()).toHaveLength(2));
    expect(clocks().map(({ style }) => style)).toEqual(["box", "traditional"]);
  });
  it("opens a Zone clock card's editor with its clock selected", async () => {
    setup(); await addClock();
    fireEvent.click(screen.getByRole("button", { name: "Add clock" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(clocks()).toHaveLength(2));
    fireEvent.click(screen.getByRole("button", { name: "Edit Clock 2 clock" }));
    expect(screen.getByRole("combobox", { name: "Clock to edit" })).toHaveValue(clocks()[1].id);
    expect(screen.getByLabelText("Clock name")).toHaveValue("Clock 2");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(clocks()[1].name).toBe("Clock 2");
  });
  it("deletes a clock directly from its card with exact undo/redo", async () => {
    setup(); await addClock();
    const before = structuredClone(zone().clocks);
    fireEvent.click(screen.getByRole("button", { name: "Delete Clock 1 clock" }));
    await waitFor(() => expect(clocks()).toHaveLength(0));
    act(() => store.dispatch(undoEncounterChange())); expect(zone().clocks).toEqual(before);
    act(() => store.dispatch(redoEncounterChange())); expect(clocks()).toHaveLength(0);
  });
  it("clamps on shrink and defers removal until Save, with dirty discard", async () => {
    setup(); await addClock();
    fireEvent.click(screen.getByRole("button", { name: "Reset Clock 1 to maximum" })); fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(clocks()[0].value).toBe(4));
    fireEvent.click(screen.getByRole("button", { name: "Edit clocks" }));
    fireEvent.change(screen.getByLabelText("Segments (1–12)"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(clocks()[0]).toMatchObject({ segments: 1, value: 1 }));
    fireEvent.click(screen.getByRole("button", { name: "Edit clocks" })); fireEvent.click(screen.getByRole("button", { name: "Remove clock" }));
    expect(clocks()).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" })); fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(clocks()).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Edit clocks" })); fireEvent.click(screen.getByRole("button", { name: "Remove clock" })); fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(clocks()).toHaveLength(0));
    act(() => store.dispatch(undoEncounterChange())); expect(clocks()).toHaveLength(1);
  });
  it("disables controls in read-only sessions and also enforces the central writer guard", async () => {
    const view = setup(["z"], true, true);
    for (const button of screen.getAllByRole("button")) expect(button).toBeDisabled();
    expect(screen.getByLabelText("Add zone tag")).toBeDisabled(); expect(screen.getByLabelText("Notes")).toBeDisabled();
    view.unmount(); setup(); setPersistenceWritable(false);
    fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "Blocked" } }); fireEvent.blur(screen.getByLabelText("Notes"));
    await act(async () => {}); expect(zone().notes).toBeUndefined(); expect(store.getState().encounter.past).toHaveLength(0);
  });
  it("cancels pending changes after encounter navigation", async () => {
    setup(); fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "Old encounter" } }); fireEvent.blur(screen.getByLabelText("Notes"));
    act(() => store.dispatch(loadEncounterState(createEncounterState({ id: "other", name: "Other" }))));
    await act(async () => {}); expect(store.getState().encounter.present.id).toBe("other"); expect(store.getState().encounter.past).toHaveLength(0);
  });
});
