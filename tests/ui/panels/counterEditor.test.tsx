import { setup } from "./counterEditorSetup";
import { flushSync } from "react-dom";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { undoEncounterChange, redoEncounterChange } from "@store/encounterSlice";
import { store } from "@store/store";


describe("Edit counter numeric fields", () => {
  it.each(["minimum", "maximum"])("uses the correct starting value when stepping empty %s", (name) => {
    setup();
    const label = name === "minimum" ? "Minimum (optional)" : "Maximum (optional)";
    expect(screen.getByLabelText(label)).toHaveValue(null);
    expect(screen.getByRole("button", { name: `Clear ${name}` })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: `Increase ${name}` }));
    expect(screen.getByLabelText(label)).toHaveValue(name === "maximum" ? 1 : 0);
    fireEvent.click(screen.getByRole("button", { name: `Increase ${name}` }));
    expect(screen.getByLabelText(label)).toHaveValue(name === "maximum" ? 2 : 1);
    fireEvent.click(screen.getByRole("button", { name: `Clear ${name}` }));
    fireEvent.click(screen.getByRole("button", { name: `Decrease ${name}` }));
    expect(screen.getByLabelText(label)).toHaveValue(0);
    fireEvent.click(screen.getByRole("button", { name: `Decrease ${name}` }));
    expect(screen.getByLabelText(label)).toHaveValue(-1);
    fireEvent.click(screen.getByRole("button", { name: `Clear ${name}` }));
    fireEvent.keyDown(screen.getByLabelText(label), { key: "ArrowUp" });
    expect(screen.getByLabelText(label)).toHaveValue(name === "maximum" ? 1 : 0);
    fireEvent.click(screen.getByRole("button", { name: `Clear ${name}` }));
    fireEvent.keyDown(screen.getByLabelText(label), { key: "ArrowDown" });
    expect(screen.getByLabelText(label)).toHaveValue(0);
  });
  it("starts cleared current at zero and supports keyboard stepping without changing typed values", () => {
    setup();
    const input = screen.getByLabelText("Current value");
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.keyDown(input, { key: "ArrowDown" }); expect(input).toHaveValue(0);
    fireEvent.keyDown(input, { key: "ArrowDown" }); expect(input).toHaveValue(-1);
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.keyDown(input, { key: "ArrowUp" }); expect(input).toHaveValue(0);
    fireEvent.change(input, { target: { value: "12" } }); expect(input).toHaveValue(12);
  });
  it("clears both limits only on save and restores them through undo/redo", async () => {
    setup(true);
    fireEvent.click(screen.getByRole("button", { name: "Clear minimum" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear maximum" }));
    expect(store.getState().encounter.present.actors.byId.a.counters!.byId.c).toMatchObject({ minimum: -2, maximum: 5 });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(store.getState().encounter.present.actors.byId.a.counters!.byId.c).toEqual({ id: "c", name: "Charges", value: 0 }));
    act(() => store.dispatch(undoEncounterChange()));
    expect(store.getState().encounter.present.actors.byId.a.counters!.byId.c).toMatchObject({ minimum: -2, maximum: 5 });
    act(() => store.dispatch(redoEncounterChange()));
    expect(store.getState().encounter.present.actors.byId.a.counters!.byId.c).toEqual({ id: "c", name: "Charges", value: 0 });
  });
  it("discards cleared bounds when the modal is canceled", () => {
    setup(true);
    fireEvent.click(screen.getByRole("button", { name: "Clear minimum" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("dialog", { name: "Unsaved counter changes" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(store.getState().encounter.present.actors.byId.a.counters!.byId.c.minimum).toBe(-2);
    expect(store.getState().encounter.past).toHaveLength(0);
  });
});

describe("new counter placeholder names", () => {
  it("saves unnamed counters, reuses numbering gaps and preserves custom names", async () => {
    setup(); fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Add counter" }));
    expect(screen.getByLabelText("Counter name")).toHaveAttribute("placeholder", "Counter 1");
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByRole("group", { name: "Counter 1" });
    fireEvent.click(screen.getByRole("button", { name: "Add counter" }));
    expect(screen.getByLabelText("Counter name")).toHaveAttribute("placeholder", "Counter 2");
    fireEvent.change(screen.getByLabelText("Counter name"), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByRole("group", { name: "Counter 2" });
    fireEvent.click(screen.getByRole("button", { name: "Edit counters" }));
    const firstCounterId = Object.values(store.getState().encounter.present.actors.byId.a.counters!.byId).find((counter) => counter.name === "Counter 1")!.id;
    fireEvent.change(screen.getByLabelText("Counter to edit"), { target: { value: firstCounterId } });
    fireEvent.click(screen.getByRole("button", { name: "Remove counter" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByRole("group", { name: "Counter 1" })).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Add counter" }));
    expect(screen.getByLabelText("Counter name")).toHaveAttribute("placeholder", "Counter 1");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByRole("group", { name: "Counter 1" });
    act(() => store.dispatch(undoEncounterChange()));
    expect(screen.queryByRole("group", { name: "Counter 1" })).not.toBeInTheDocument();
    act(() => store.dispatch(redoEncounterChange()));
    expect(screen.getByRole("group", { name: "Counter 1" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add counter" }));
    expect(screen.getByLabelText("Counter name")).toHaveAttribute("placeholder", "Counter 3");
    fireEvent.change(screen.getByLabelText("Counter name"), { target: { value: "  Spell slots  " } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByRole("group", { name: "Spell slots" });
  });
  it("resolves generated name conflicts when new counters are saved rapidly", async () => {
    setup(); fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    act(() => {
      flushSync(() => fireEvent.click(screen.getByRole("button", { name: "Add counter" })));
      flushSync(() => fireEvent.click(screen.getByRole("button", { name: "Save" })));
      flushSync(() => fireEvent.click(screen.getByRole("button", { name: "Add counter" })));
      flushSync(() => fireEvent.click(screen.getByRole("button", { name: "Save" })));
    });
    await screen.findByRole("group", { name: "Counter 2" });
    const names = Object.values(store.getState().encounter.present.actors.byId.a.counters!.byId).map((counter) => counter.name);
    expect(names).toEqual(["Charges", "Counter 1", "Counter 2"]);
    expect(store.getState().encounter.past).toHaveLength(2);
  });
});

describe("counter editor bound shortcuts", () => {
  it("uses configured bounds and commits the draft only on save", async () => {
    setup(true);
    const current = screen.getByLabelText("Current value");
    const minimum = screen.getByRole("button", { name: "Set to minimum" });
    const maximum = screen.getByRole("button", { name: "Set to maximum" });
    expect(minimum).toHaveAttribute("title", "Set to minimum");
    expect(maximum).toHaveAttribute("title", "Set to maximum");
    fireEvent.click(minimum); expect(current).toHaveValue(-2);
    fireEvent.click(maximum); expect(current).toHaveValue(5);
    expect(store.getState().encounter.present.actors.byId.a.counters!.byId.c.value).toBe(0);
    fireEvent.change(screen.getByLabelText("Maximum (optional)"), { target: { value: "8" } });
    fireEvent.click(maximum); expect(current).toHaveValue(8);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(store.getState().encounter.present.actors.byId.a.counters!.byId.c.value).toBe(8));
    act(() => store.dispatch(undoEncounterChange()));
    expect(store.getState().encounter.present.actors.byId.a.counters!.byId.c.value).toBe(0);
  });
  it("defaults minimum to zero and disables maximum until one is set", () => {
    setup();
    const current = screen.getByLabelText("Current value");
    const minimum = screen.getByRole("button", { name: "Set to minimum" });
    expect(minimum).toHaveAttribute("title", "Set to minimum (0 by default)");
    const maximum = screen.getByRole("button", { name: "Set to maximum" });
    expect(maximum).toBeDisabled(); expect(maximum).toHaveAttribute("title", "Set to maximum");
    fireEvent.change(current, { target: { value: "3" } });
    fireEvent.click(maximum); expect(current).toHaveValue(3);
    fireEvent.click(screen.getByRole("button", { name: "Set to minimum" })); expect(current).toHaveValue(0);
    fireEvent.change(screen.getByLabelText("Maximum (optional)"), { target: { value: "0" } });
    expect(maximum).toBeEnabled(); expect(maximum).toHaveAttribute("title", "Set to maximum");
    fireEvent.click(maximum); expect(current).toHaveValue(0);
    fireEvent.click(screen.getByRole("button", { name: "Clear maximum" }));
    expect(maximum).toBeDisabled(); expect(maximum).toHaveAttribute("title", "Set to maximum");
    fireEvent.change(screen.getByLabelText("Minimum (optional)"), { target: { value: "-5" } });
    expect(minimum).toHaveAttribute("title", "Set to minimum");
    fireEvent.click(minimum); expect(current).toHaveValue(-5);
    fireEvent.click(screen.getByRole("button", { name: "Clear minimum" }));
    expect(minimum).toHaveAttribute("title", "Set to minimum (0 by default)");
    fireEvent.click(screen.getByRole("button", { name: "Set to minimum" })); expect(current).toHaveValue(0);
  });
});

describe("counter selection in the shared editor", () => {
  it("shows one header edit control and switches counter details through the selector", async () => {
    setup(true);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Add counter" }));
    fireEvent.change(screen.getByLabelText("Counter name"), { target: { value: "Spell slots" } });
    fireEvent.change(screen.getByLabelText("Current value"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("Maximum (optional)"), { target: { value: "7" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByRole("group", { name: "Spell slots" });
    expect(screen.queryByRole("button", { name: "Edit Charges" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove Charges" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Edit counters" })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Edit counters" })).toHaveAttribute("title", "Edit counters");
    fireEvent.click(screen.getByRole("button", { name: "Edit counters" }));
    const secondId = Object.values(store.getState().encounter.present.actors.byId.a.counters!.byId).find((counter) => counter.name === "Spell slots")!.id;
    fireEvent.change(screen.getByLabelText("Counter to edit"), { target: { value: secondId } });
    expect(screen.getByLabelText("Counter name")).toHaveValue("Spell slots");
    expect(screen.getByLabelText("Current value")).toHaveValue(3);
    expect(screen.getByLabelText("Minimum (optional)")).toHaveValue(null);
    expect(screen.getByLabelText("Maximum (optional)")).toHaveValue(7);
    fireEvent.change(screen.getByLabelText("Current value"), { target: { value: "4" } });
    fireEvent.change(screen.getByLabelText("Counter to edit"), { target: { value: "c" } });
    expect(screen.queryByRole("dialog", { name: "Unsaved counter changes" })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Spell slots ✎" })).toBeInTheDocument();
    expect(screen.getByLabelText("Counter name")).toHaveValue("Charges");
    expect(screen.getByLabelText("Current value")).toHaveValue(0);
    expect(screen.getByLabelText("Minimum (optional)")).toHaveValue(-2);
    expect(screen.getByLabelText("Maximum (optional)")).toHaveValue(5);
    expect(store.getState().encounter.present.actors.byId.a.counters!.byId[secondId].value).toBe(3);
    fireEvent.change(screen.getByLabelText("Current value"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Counter to edit"), { target: { value: secondId } });
    expect(screen.getByLabelText("Current value")).toHaveValue(4);
    expect(screen.getByRole("option", { name: "Spell slots ✎" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    fireEvent.keyDown(screen.getByLabelText("Current value"), { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(store.getState().encounter.present.actors.byId.a.counters!.byId[secondId].value).toBe(4));
    expect(store.getState().encounter.present.actors.byId.a.counters!.byId.c.value).toBe(2);
    expect(store.getState().encounter.past).toHaveLength(2);
    act(() => store.dispatch(undoEncounterChange()));
    expect(store.getState().encounter.present.actors.byId.a.counters!.byId[secondId].value).toBe(3);
    expect(store.getState().encounter.present.actors.byId.a.counters!.byId.c.value).toBe(0);
    act(() => store.dispatch(redoEncounterChange()));
    expect(store.getState().encounter.present.actors.byId.a.counters!.byId[secondId].value).toBe(4);
    expect(store.getState().encounter.present.actors.byId.a.counters!.byId.c.value).toBe(2);
  });
  it("keeps Edit counters visible after removing the last counter and undoing", async () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Remove counter" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(store.getState().encounter.present.actors.byId.a.counters!.allIds).toHaveLength(0));
    expect(screen.getByRole("button", { name: "Edit counters" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add counter" })).toBeInTheDocument();
    act(() => store.dispatch(undoEncounterChange()));
    expect(screen.getByRole("button", { name: "Edit counters" })).toBeInTheDocument();
  });
});

it("preserves invalid drafts across switching and disables saving the whole draft", () => {
  setup(false, true);
  fireEvent.change(screen.getByLabelText("Current value"), { target: { value: "" } });
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  const prompt = screen.getByRole("dialog", { name: "Unsaved counter changes" });
  expect(within(prompt).getByRole("button", { name: "Save changes" })).toBeDisabled();
  fireEvent.click(within(prompt).getByRole("button", { name: "Keep editing" }));
  fireEvent.change(screen.getByLabelText("Counter to edit"), { target: { value: "second" } });
  expect(screen.getByLabelText("Current value")).toHaveValue(3);
  expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Counter to edit"), { target: { value: "c" } });
  expect(screen.getByLabelText("Current value")).toHaveValue(null);
  fireEvent.change(screen.getByLabelText("Current value"), { target: { value: "0" } });
  expect(screen.getByRole("option", { name: "Charges" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(store.getState().encounter.past).toHaveLength(0);
});

it("keeps counter removal in the draft and restores it when discarded", () => {
  setup();
  fireEvent.click(screen.getByRole("button", { name: "Remove counter" }));
  expect(store.getState().encounter.present.actors.byId.a.counters!.allIds).toEqual(["c"]);
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
  expect(screen.getByRole("group", { name: "Charges" })).toBeInTheDocument();
  expect(store.getState().encounter.past).toHaveLength(0);
});
