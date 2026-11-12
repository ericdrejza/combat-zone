import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { Provider } from "react-redux";
import { afterEach, beforeEach, expect, it } from "vitest";
import { createEncounterState } from "@core/encounter/createEncounterState";
import { loadEncounterState, undoEncounterChange, redoEncounterChange } from "@store/encounterSlice";
import { appendEncounterLogEntry, resetEncounterLog, toggleSystemLogs } from "@store/encounterLogSlice";
import { setPersistenceWritable } from "@store/persistenceWriteGuardMiddleware";
import { store } from "@store/store";
import { LogPanel, LogPanelHeaderActions } from "@ui/panels/LogPanel";

function setup(mode: "ADVISORY" | "STRICT" = "ADVISORY") {
  const encounter = createEncounterState({ id: "deletions", name: "Deletion test" });
  encounter.validationState.mode = mode;
  for (const id of ["first", "second"]) {
    encounter.chatMessages.allIds.push(id);
    encounter.chatMessages.byId[id] = { id, message: id, timestamp: 1,
      sender: { id: "game-master", name: "Game Master", color: null } };
  }
  store.dispatch(loadEncounterState(encounter));
  store.dispatch(appendEncounterLogEntry({ id: "system", actionId: "action", actionType: "actor.move",
    kind: "commit", category: "actor", message: "System event", timestamp: 2 }));
  render(<Provider store={store}><LogPanelHeaderActions /><LogPanel /></Provider>);
}

beforeEach(() => {
  setPersistenceWritable(true);
  store.dispatch(resetEncounterLog());
  if (store.getState().encounterLog.showSystemLogs) store.dispatch(toggleSystemLogs());
});
afterEach(() => setPersistenceWritable(true));

it.each(["ADVISORY", "STRICT"] as const)("keeps deleted messages outside undo/redo in %s mode", mode => {
  setup(mode);
  const row = screen.getByText("first").closest("li")!;
  fireEvent.click(within(row).getByRole("button", { name: "Delete chat message" }));
  expect(screen.queryByText("first")).not.toBeInTheDocument();
  expect(screen.getByText("second")).toBeInTheDocument();
  expect(store.getState().encounter.present.chatMessages.allIds).toEqual(["second"]);
  act(() => { store.dispatch(undoEncounterChange()); });
  expect(store.getState().encounter.present.chatMessages.allIds).toEqual(["second"]);
  act(() => { store.dispatch(redoEncounterChange()); });
  expect(store.getState().encounter.present.chatMessages.allIds).toEqual(["second"]);
});

it("does not offer individual deletion for system entries", () => {
  setup();
  const before = store.getState().encounter;
  fireEvent.click(screen.getByRole("button", { name: "Show system logs" }));
  const row = screen.getByText("System event").closest("li")!;
  expect(within(row).queryByRole("button")).not.toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: "Delete chat message" })).toHaveLength(2);
  expect(store.getState().encounter).toBe(before);
  expect(store.getState().encounterLog.entries).toHaveLength(1);
});

it("clears hidden system entries and all saved chat without a history step", () => {
  setup();
  fireEvent.click(screen.getByRole("button", { name: "Clear encounter log" }));
  expect(store.getState().encounter.present.chatMessages).toEqual({ byId: {}, allIds: [] });
  expect(store.getState().encounterLog.entries).toEqual([]);
  expect(store.getState().encounter.past).toHaveLength(0);
  act(() => { store.dispatch(undoEncounterChange()); });
  expect(store.getState().encounter.present.chatMessages.allIds).toEqual([]);
  act(() => { store.dispatch(redoEncounterChange()); });
  expect(store.getState().encounter.present.chatMessages.allIds).toEqual([]);
});

it("does not create a history step when clearing only system entries", () => {
  setup();
  const encounter = store.getState().encounter.present;
  act(() => { store.dispatch(loadEncounterState({ ...encounter, chatMessages: { byId: {}, allIds: [] } })); });
  fireEvent.click(screen.getByRole("button", { name: "Clear encounter log" }));
  expect(store.getState().encounter.past).toHaveLength(0);
  expect(store.getState().encounterLog.entries).toEqual([]);
});

it("blocks clearing and individual deletion when the writer lock is lost", () => {
  setup();
  const before = store.getState();
  setPersistenceWritable(false);
  fireEvent.click(screen.getAllByRole("button", { name: "Delete chat message" })[0]);
  fireEvent.click(screen.getByRole("button", { name: "Clear encounter log" }));
  expect(store.getState().encounter).toBe(before.encounter);
  expect(store.getState().encounterLog.entries).toEqual(before.encounterLog.entries);
});
