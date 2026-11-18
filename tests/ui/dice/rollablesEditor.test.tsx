import { OPEN_DICE_NOTATION_EVENT } from "@ui/settings/settingsNavigation";
import { resetAppStore } from "@tests/ui/renderApp";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Provider } from "react-redux";
import { beforeEach, expect, it } from "vitest";
import { diceEncounter, slash } from "@tests/core/dice/fixtures";
import { selectEntity, setActiveTool } from "@interaction/interactionState";
import { store } from "@store/store";
import { loadEncounterState, undoEncounterChange, redoEncounterChange } from "@store/encounterSlice";
import { setPersistenceWritable } from "@store/persistenceWriteGuardMiddleware";
import { StatusPanel } from "@ui/panels/StatusPanel";

beforeEach(() => { setPersistenceWritable(true); });
function setup(empty = false) {
  resetAppStore();
  const state = diceEncounter();
  state.actors.byId.a.rollables = empty ? { allIds: [], byId: {} } : {
    allIds: ["slash", "heal"], byId: { slash: { ...slash }, heal: { ...slash, id: "heal", name: "Restore", checkFormula: "", checkRollMode: "shared", effectKind: "healing" } }
  };
  store.dispatch(loadEncounterState(state));
  store.dispatch(setActiveTool("select"));
  store.dispatch(selectEntity({ entityType: "actor", ids: ["a"] }));
  render(<Provider store={store}><StatusPanel /></Provider>);
  fireEvent.click(screen.getByRole("button", { name: "Edit Rollables" }));
}
function openSelector() {
  const selector = screen.getByRole("combobox", { name: "Rollable to edit" });
  fireEvent.click(selector); return selector;
}
it("creates from the selector like the counter editor, selecting the new draft and requiring its effect", async () => {
  setup(true);
  expect(screen.queryByRole("combobox", { name: "Rollable to edit" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Create new Rollable" }));
  expect(screen.getByRole("combobox", { name: "Rollable to edit" })).toHaveTextContent("Unnamed Rollable");
  expect(screen.getByRole("combobox", { name: "Rollable to edit" })).toHaveAttribute("aria-expanded", "false");
  fireEvent.change(screen.getByRole("textbox", { name: "Rollable name" }), { target: { value: "Skill" } });
  fireEvent.change(screen.getByRole("textbox", { name: "Check roll" }), { target: { value: "d20" } });
  expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  expect(screen.getByRole("textbox", { name: "Effect roll" })).toBeRequired();
  fireEvent.change(screen.getByRole("textbox", { name: "Effect roll" }), { target: { value: "  " } });
  expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  fireEvent.change(screen.getByRole("textbox", { name: "Effect roll" }), { target: { value: "d6" } });
  fireEvent.change(screen.getByRole("combobox", { name: "Effect kind" }), { target: { value: "none" } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(store.getState().encounter.present.actors.byId.a.rollables!.allIds).toHaveLength(1));
  const saved = store.getState().encounter.present.actors.byId.a.rollables!;
  expect(saved.byId[saved.allIds[0]]).toMatchObject({ name: "Skill", effectFormula: "d6", effectKind: "none" });
});
it("keeps the dropdown open across successive reorders and commits order once with undo/redo", async () => {
  setup(); const selector = openSelector();
  const popup = screen.getByRole("dialog", { name: "Rollable to edit" });
  fireEvent.click(within(popup).getByRole("button", { name: "Move Restore up" }));
  expect(selector).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByRole("textbox", { name: "Rollable name" })).toHaveValue("Slash");
  fireEvent.click(within(popup).getByRole("button", { name: "Move Restore down" }));
  expect(selector).toHaveAttribute("aria-expanded", "true");
  fireEvent.click(within(popup).getByRole("button", { name: "Move Restore up" }));
  expect(store.getState().encounter.present.actors.byId.a.rollables!.allIds).toEqual(["slash", "heal"]);
  fireEvent.click(within(popup).getByRole("button", { name: "Restore" }));
  expect(selector).toHaveAttribute("aria-expanded", "false");
  expect(screen.getByRole("textbox", { name: "Rollable name" })).toHaveValue("Restore");
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(store.getState().encounter.present.actors.byId.a.rollables!.allIds).toEqual(["heal", "slash"]));
  expect(store.getState().encounter.past).toHaveLength(1);
  act(() => { store.dispatch(undoEncounterChange()); });
  expect(store.getState().encounter.present.actors.byId.a.rollables!.allIds).toEqual(["slash", "heal"]);
  act(() => { store.dispatch(redoEncounterChange()); });
  expect(store.getState().encounter.present.actors.byId.a.rollables!.allIds).toEqual(["heal", "slash"]);
});
it("Escape closes the dropdown first and leaves the editor and draft open", () => {
  setup(); const selector = openSelector();
  fireEvent.keyDown(screen.getByRole("dialog", { name: "Rollable to edit" }), { key: "Escape" });
  expect(selector).toHaveAttribute("aria-expanded", "false");
  expect(screen.getByRole("textbox", { name: "Rollable name" })).toHaveValue("Slash");
  expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
});
it("deletion stays a draft and Cancel preserves the list", () => {
  setup(); fireEvent.click(screen.getByRole("button", { name: "Delete" }));
  expect(screen.getByRole("textbox", { name: "Rollable name" })).toHaveValue("Restore");
  expect(store.getState().encounter.present.actors.byId.a.rollables!.allIds).toEqual(["slash", "heal"]);
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.queryByRole("textbox", { name: "Rollable name" })).not.toBeInTheDocument();
  expect(store.getState().encounter.present.actors.byId.a.rollables!.allIds).toEqual(["slash", "heal"]);
});

it("opens notation help from either formula without saving or losing the draft", () => {
  setup();
  const requests: Event[] = [];
  const listener = (event: Event) => requests.push(event);
  window.addEventListener(OPEN_DICE_NOTATION_EVENT, listener);
  try {
    fireEvent.change(screen.getByRole("textbox", { name: "Check roll" }), { target: { value: "d20+7" } });
    for (const formula of ["Check", "Effect"]) {
      fireEvent.click(screen.getByRole("button", { name: `${formula} roll notation help` }));
      expect(screen.getByRole("textbox", { name: "Check roll" })).toHaveValue("d20+7");
    }
    expect(requests).toHaveLength(2);
    expect(store.getState().encounter.past).toHaveLength(0);
  } finally { window.removeEventListener(OPEN_DICE_NOTATION_EVENT, listener); }
});

it('saves the per-Rollable check mode in one history step and restores it with undo/redo', async () => {
  setup();
  const mode = screen.getByRole('combobox', { name: 'Check roll mode' }); expect(mode).toHaveValue('shared');
  fireEvent.change(mode, { target: { value: 'ask' } });
  expect(store.getState().encounter.present.actors.byId.a.rollables!.byId.slash.checkRollMode).toBe('shared');
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(store.getState().encounter.present.actors.byId.a.rollables!.byId.slash.checkRollMode).toBe('ask');
  act(() => store.dispatch(undoEncounterChange()));
  expect(store.getState().encounter.present.actors.byId.a.rollables!.byId.slash.checkRollMode).toBe('shared');
  act(() => store.dispatch(redoEncounterChange()));
  expect(store.getState().encounter.present.actors.byId.a.rollables!.byId.slash.checkRollMode).toBe('ask');
});
