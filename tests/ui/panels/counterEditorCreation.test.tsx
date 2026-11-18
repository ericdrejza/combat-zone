import { openEditorSelector } from "@tests/ui/controls/editorSelectTestHelpers";
import { chooseEditorRecord, expectEditorChoice } from "@tests/ui/controls/editorSelectTestHelpers";
import { act, fireEvent, screen, within } from "@testing-library/react";
import { undoEncounterChange, redoEncounterChange } from "@store/encounterSlice";
import { store } from "@store/store";
import { setup } from "./counterEditorSetup";

it("creates empty counters from the last dropdown option and saves them with all edits", async () => {
  setup();
  expect(screen.getByRole("dialog", { name: "Edit counters" })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Current value"), { target: { value: "2" } });
  const popup = openEditorSelector("Counter to edit");
  expect(within(popup).getByRole("button", { name: "Create new counter" })).toBeInTheDocument();
  chooseEditorRecord("Counter to edit", "");
  expect(screen.getByLabelText("Counter name")).toHaveValue("");
  expect(screen.getByLabelText("Counter name")).toHaveAttribute("placeholder", "Counter 1");
  expect(screen.getByLabelText("Current value")).toHaveValue(0);
  expect(screen.getByLabelText("Minimum (optional)")).toHaveValue(null);
  expect(screen.getByLabelText("Maximum (optional)")).toHaveValue(null);
  expectEditorChoice("Counter to edit", "Counter 1");
  const newId = (screen.getByLabelText("Counter to edit") as HTMLButtonElement).value;
  expect(store.getState().encounter.present.actors.byId.a.counters!.allIds).toEqual(["c"]);
  fireEvent.change(screen.getByLabelText("Current value"), { target: { value: "4" } });
  chooseEditorRecord("Counter to edit", "c");
  expect(screen.getByLabelText("Current value")).toHaveValue(2);
  chooseEditorRecord("Counter to edit", newId);
  expect(screen.getByLabelText("Current value")).toHaveValue(4);
  chooseEditorRecord("Counter to edit", "");
  expect(screen.getByLabelText("Counter name")).toHaveAttribute("placeholder", "Counter 2");
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await screen.findByRole("group", { name: "Counter 2" });
  const saved = store.getState().encounter.present.actors.byId.a.counters!;
  expect(saved.byId.c.value).toBe(2);
  expect(saved.byId[newId]).toMatchObject({ name: "Counter 1", value: 4 });
  expect(store.getState().encounter.past).toHaveLength(1);
  act(() => store.dispatch(undoEncounterChange()));
  expect(store.getState().encounter.present.actors.byId.a.counters!.allIds).toEqual(["c"]);
  expect(store.getState().encounter.present.actors.byId.a.counters!.byId.c.value).toBe(0);
  act(() => store.dispatch(redoEncounterChange()));
  expect(store.getState().encounter.present.actors.byId.a.counters).toEqual(saved);
});

it("discards a counter created in the shared editor without adding history", () => {
  setup();
  chooseEditorRecord("Counter to edit", "");
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(store.getState().encounter.present.actors.byId.a.counters!.allIds).toEqual(["c"]);
  expect(store.getState().encounter.past).toHaveLength(0);
});

it("disables current-value stepping at draft bounds and blocks keyboard stepping beyond them", () => {
  setup(true);
  const input = screen.getByLabelText("Current value");
  const decrease = screen.getByRole("button", { name: "Decrease current value" });
  const increase = screen.getByRole("button", { name: "Increase current value" });
  fireEvent.click(screen.getByRole("button", { name: "Set to minimum" }));
  expect(decrease).toBeDisabled();
  expect(increase).toBeEnabled();
  fireEvent.keyDown(input, { key: "ArrowDown" });
  expect(input).toHaveValue(-2);
  fireEvent.click(increase);
  expect(decrease).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "Set to maximum" }));
  expect(increase).toBeDisabled();
  expect(decrease).toBeEnabled();
  fireEvent.keyDown(input, { key: "ArrowUp" });
  expect(input).toHaveValue(5);
  fireEvent.click(screen.getByRole("button", { name: "Clear maximum" }));
  expect(increase).toBeEnabled();
  fireEvent.click(increase);
  expect(input).toHaveValue(6);
  fireEvent.change(screen.getByLabelText("Minimum (optional)"), { target: { value: "6" } });
  expect(decrease).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Clear minimum" }));
  expect(decrease).toBeEnabled();
  fireEvent.click(decrease);
  expect(input).toHaveValue(5);
});


it("opens Edit counters with no counters and creates the first counter there", async () => {
  setup(false, false, true);
  expect(screen.getByRole("dialog", { name: "Edit counters" })).toBeInTheDocument();
  expect(screen.getByText("No counters yet. Choose Create new counter to add one.")).toBeInTheDocument();
  chooseEditorRecord("Counter to edit", "create");
  expect(screen.getByLabelText("Counter name")).toHaveAttribute("placeholder", "Counter 1");
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await screen.findByRole("group", { name: "Counter 1" });
  expect(store.getState().encounter.past).toHaveLength(1);
  act(() => store.dispatch(undoEncounterChange()));
  expect(store.getState().encounter.present.actors.byId.a.counters!.allIds).toHaveLength(0);
  expect(screen.getByRole("button", { name: "Edit counters" })).toBeEnabled();
  act(() => store.dispatch(redoEncounterChange()));
  expect(screen.getByRole("group", { name: "Counter 1" })).toBeInTheDocument();
});
