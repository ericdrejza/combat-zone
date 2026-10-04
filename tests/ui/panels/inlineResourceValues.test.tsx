import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { store } from "@store/store";
import { undoEncounterChange, redoEncounterChange } from "@store/encounterSlice";
import { setup } from "./counterEditorSetup";

it("selects the counter value for digit-only editing and saves once with undo/redo", async () => {
  setup(true);
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  fireEvent.click(screen.getByRole("button", { name: "Edit Charges value" }));
  const input = screen.getByRole("textbox", { name: "Edit Charges value" }) as HTMLInputElement;
  expect(input).toHaveFocus();
  expect(input.selectionStart).toBe(0);
  expect(input.selectionEnd).toBe(1);
  fireEvent.change(input, { target: { value: "abc" } });
  expect(input).toHaveValue("0");
  fireEvent.change(input, { target: { value: "2.5" } });
  expect(input).toHaveValue("0");
  fireEvent.change(input, { target: { value: "-2" } });
  expect(input).toHaveValue("0");
  fireEvent.change(input, { target: { value: "4" } });
  expect(store.getState().encounter.past).toHaveLength(0);
  fireEvent.keyDown(input, { key: "Enter" });
  await waitFor(() => expect(store.getState().encounter.present.actors.byId.a.counters!.byId.c.value).toBe(4));
  expect(store.getState().encounter.past).toHaveLength(1);
  act(() => store.dispatch(undoEncounterChange()));
  expect(store.getState().encounter.present.actors.byId.a.counters!.byId.c.value).toBe(0);
  act(() => store.dispatch(redoEncounterChange()));
  expect(store.getState().encounter.present.actors.byId.a.counters!.byId.c.value).toBe(4);
});

it("cancels inline edits with Escape or an empty draft, and clamps on blur", async () => {
  setup(true);
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  fireEvent.click(screen.getByRole("button", { name: "Edit Charges value" }));
  let input = screen.getByRole("textbox", { name: "Edit Charges value" });
  fireEvent.change(input, { target: { value: "3" } });
  fireEvent.keyDown(input, { key: "Escape" });
  expect(store.getState().encounter.past).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", { name: "Edit Charges value" }));
  input = screen.getByRole("textbox", { name: "Edit Charges value" });
  fireEvent.change(input, { target: { value: "" } });
  fireEvent.blur(input);
  expect(store.getState().encounter.past).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", { name: "Edit Charges value" }));
  input = screen.getByRole("textbox", { name: "Edit Charges value" });
  fireEvent.change(input, { target: { value: "20" } });
  fireEvent.blur(input);
  await waitFor(() => expect(store.getState().encounter.present.actors.byId.a.counters!.byId.c.value).toBe(5));
});


it("cancels a counter reset when clicking its confirmation backdrop", () => {
  setup(true);
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  fireEvent.click(screen.getByRole("button", { name: "Reset Charges to maximum" }));
  const dialog = screen.getByRole("dialog", { name: "Reset Charges?" });
  fireEvent.click(dialog);
  expect(dialog).toBeInTheDocument();
  fireEvent.click(dialog.parentElement!);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(store.getState().encounter.present.actors.byId.a.counters!.byId.c.value).toBe(0);
  expect(store.getState().encounter.past).toHaveLength(0);
});

it("cancels the discard/save confirmation on its backdrop while keeping the draft", () => {
  setup();
  fireEvent.change(screen.getByLabelText("Current value"), { target: { value: "3" } });
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  const dialog = screen.getByRole("dialog", { name: "Unsaved counter changes" });
  fireEvent.click(dialog.parentElement!);
  expect(screen.queryByRole("dialog", { name: "Unsaved counter changes" })).not.toBeInTheDocument();
  expect(screen.getByRole("dialog", { name: "Edit counters" })).toBeInTheDocument();
  expect(screen.getByLabelText("Current value")).toHaveValue(3);
  expect(store.getState().encounter.past).toHaveLength(0);
});
