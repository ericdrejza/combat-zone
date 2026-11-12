import { act, fireEvent, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { store } from "@store/store";
import { loadEncounterState, resetEncounterState, undoEncounterChange, redoEncounterChange } from "@store/encounterSlice";
import { resetEncounterLog, toggleSystemLogs } from "@store/encounterLogSlice";
import { setPersistenceWritable } from "@store/persistenceWriteGuardMiddleware";
import { LogPanel, LogPanelHeaderActions } from "@ui/panels/LogPanel";

function setup() {
  render(<Provider store={store}><LogPanelHeaderActions /><LogPanel /></Provider>);
  return screen.getByRole("textbox", { name: "Chat message" });
}
function send(text: string) {
  fireEvent.change(screen.getByRole("textbox"), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
}
beforeEach(() => {
  setPersistenceWritable(true);
  store.dispatch(resetEncounterState());
  store.dispatch(resetEncounterLog());
  if (store.getState().encounterLog.showSystemLogs) store.dispatch(toggleSystemLogs());
});
afterEach(() => { setPersistenceWritable(true); vi.unstubAllGlobals(); });

describe("encounter chat", () => {
  it("sends on desktop Enter, preserves multiline drafts, and stays outside undo/redo", () => {
    const input = setup();
    fireEvent.change(input, { target: { value: "First\nSecond" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    expect(store.getState().encounter.present.chatMessages.allIds).toHaveLength(0);
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    expect(store.getState().encounter.present.chatMessages.allIds).toHaveLength(0);
    fireEvent.keyDown(input, { key: "Enter" });
    const messages = store.getState().encounter.present.chatMessages;
    expect(messages.byId[messages.allIds[0]]).toMatchObject({ message: "First\nSecond", sender: { name: "Game Master", id: "game-master" } });
    expect(input).toHaveValue("");
    act(() => { store.dispatch(undoEncounterChange()); });
    expect(store.getState().encounter.present.chatMessages).toEqual(messages);
    act(() => { store.dispatch(redoEncounterChange()); });
    expect(store.getState().encounter.present.chatMessages).toEqual(messages);
  });
  it("requires the send button on mobile and ignores blank input", () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true, addEventListener() {}, removeEventListener() {} })));
    const input = setup();
    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
    fireEvent.change(input, { target: { value: "Mobile message" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(store.getState().encounter.present.chatMessages.allIds).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    expect(screen.getByText("Mobile message")).toBeInTheDocument();
  });
  it("toggles system entries without hiding chat and clears all entries", () => {
    setup(); send("Hello");
    expect(screen.getByRole("button", { name: "Show system logs" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Show system logs" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Clear encounter log" }));
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    expect(store.getState().encounter.present.chatMessages.allIds).toHaveLength(0);
    act(() => { store.dispatch(undoEncounterChange()); });
    expect(screen.queryByText("Hello")).not.toBeInTheDocument();
    act(() => { store.dispatch(redoEncounterChange()); });
    expect(store.getState().encounter.present.chatMessages.allIds).toHaveLength(0);
  });
  it("blocks writes centrally in a read-only tab without losing the draft", () => {
    setup(); act(() => setPersistenceWritable(false));
    send("Keep draft");
    expect(store.getState().encounter.present.chatMessages.allIds).toHaveLength(0);
    expect(screen.getByRole("textbox")).toHaveValue("Keep draft");
  });
  it("discards unsent drafts when the same encounter reloads", () => {
    const input = setup();
    fireEvent.change(input, { target: { value: "Unsent" } });
    act(() => { store.dispatch(loadEncounterState(store.getState().encounter.present)); });
    expect(screen.getByRole("textbox", { name: "Chat message" })).toHaveValue("");
  });
  it.each(["ADVISORY", "STRICT"] as const)("saves chat independently of %s spatial validation", mode => {
    const encounter = store.getState().encounter.present;
    store.dispatch(loadEncounterState({ ...encounter, validationState: { ...encounter.validationState, mode } }));
    setup(); send("Message");
    expect(store.getState().encounter.present.chatMessages.allIds).toHaveLength(1);
  });
});
