import { StrictMode } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Provider } from "react-redux";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { diceEncounter } from "@tests/core/dice/fixtures";
import { evaluateDice } from "@core/dice/evaluate";
import { rollFormulas } from "@core/dice/workerClient";
import { store } from "@store/store";
import { loadEncounterState, undoEncounterChange, redoEncounterChange } from "@store/encounterSlice";
import { setPersistenceWritable } from "@store/persistenceWriteGuardMiddleware";
import { LogPanel } from "@ui/panels/LogPanel";
import { ActorRollables } from "@ui/dice/ActorRollables";
import { saveDicePresentation } from "@ui/dice/dicePreferences";
vi.mock("@core/dice/workerClient", () => ({ rollFormulas: vi.fn() }));
const mockRoll = vi.mocked(rollFormulas);
function setup() { render(<StrictMode><Provider store={store}><LogPanel /></Provider></StrictMode>); }
function send(message: string) { fireEvent.change(screen.getByRole("textbox", { name: "Chat message" }), { target: { value: message } }); fireEvent.click(screen.getByRole("button", { name: "Send message" })); }
function lastMessage() { const c = store.getState().encounter.present.chatMessages; return c.byId[c.allIds.at(-1)!]; }
beforeEach(() => {
  setPersistenceWritable(true); store.dispatch(loadEncounterState(diceEncounter())); saveDicePresentation("text");
  mockRoll.mockImplementation(async formulas => formulas.map(f => evaluateDice(f, () => .5)));
});
afterEach(() => { setPersistenceWritable(true); vi.clearAllMocks(); });
it("sends multiple formulas atomically and renders permanent individual results and totals", async () => {
  setup(); send("Attack [[2d6+3]] and [[2d20kh1]]");
  await waitFor(() => expect(lastMessage()?.rolls).toHaveLength(2));
  expect(screen.getByRole("region", { name: "Roll result: 2d6+3" })).toHaveTextContent("Total: 11");
  expect(screen.getByRole("region", { name: "Roll result: 2d20kh1" })).toHaveTextContent("Total: 11");
  expect(screen.getByRole("textbox", { name: "Chat message" })).toHaveValue("");
  expect(store.getState().encounter.past).toHaveLength(0);
});
it("retains a malformed draft without rolling any of its valid expressions", () => {
  setup(); send("[[d6]] then [[d6 garbage]]");
  expect(screen.getByRole("alert")).toBeInTheDocument(); expect(mockRoll).not.toHaveBeenCalled();
  expect(store.getState().encounter.present.chatMessages.allIds).toHaveLength(0);
  expect(screen.getByRole("textbox", { name: "Chat message" })).toHaveValue("[[d6]] then [[d6 garbage]]");
});
it("discards results after the writer boundary closes or the encounter reloads", async () => {
  let complete!: (results: ReturnType<typeof evaluateDice>[]) => void;
  mockRoll.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
  setup(); send("/r d6");
  act(() => { store.dispatch(loadEncounterState(diceEncounter())); });
  await act(async () => complete([evaluateDice("d6", () => .5)]));
  expect(store.getState().encounter.present.chatMessages.allIds).toHaveLength(0);
});
it("resolves Success/Failure per target, allows one-use formula edits, and rolls one shared effect", async () => {
  setup(); send('@"Goblin Chief"/Slash -> [@Guard, @Scout]');
  const dialog = await screen.findByRole("dialog", { name: "Check result: 16" });
  fireEvent.click(within(dialog).getAllByRole("button", { name: "Success" })[0]);
  fireEvent.click(within(dialog).getAllByRole("button", { name: "Failure" })[1]);
  fireEvent.click(within(dialog).getByRole("button", { name: "Edit effect roll for Guard" }));
  expect(screen.getByRole("button", { name: "Revert to original" })).toBeDisabled();
  fireEvent.change(screen.getByRole("textbox", { name: "Effect roll" }), { target: { value: "d4" } });
  fireEvent.click(screen.getByRole("button", { name: "Revert to original" }));
  expect(screen.getByRole("textbox", { name: "Effect roll" })).toHaveValue("2d6+3");
  expect(screen.getByRole("button", { name: "Revert to original" })).toBeDisabled();
  fireEvent.change(screen.getByRole("textbox", { name: "Effect roll" }), { target: { value: "2d6+3 " } });
  expect(screen.getByRole("button", { name: "Revert to original" })).toBeEnabled();
  fireEvent.change(screen.getByRole("textbox", { name: "Effect roll" }), { target: { value: "d4" } });
  fireEvent.click(screen.getByRole("button", { name: "Roll" }));
  await waitFor(() => expect(lastMessage().invocation?.phase).toBe("resolved"));
  expect(lastMessage().invocation?.decisions).toEqual({ b: "hit", c: "miss" });
  expect(lastMessage().rolls?.map(r => r.formula)).toEqual(["d20+5", "d4"]);
  expect(store.getState().encounter.present.actors.byId.a.rollables!.byId.slash.effectFormula).toBe("2d6+3");
});
it("preserves partial decisions when resolution is dismissed and resumed", async () => {
  setup(); send('@"Goblin Chief"/Slash -> [@Guard, @Scout]');
  const dialog = await screen.findByRole("dialog");
  fireEvent.click(within(dialog).getAllByRole("button", { name: "Success" })[0]);
  fireEvent.keyDown(dialog, { key: "Escape" });
  expect(lastMessage().invocation?.decisions).toEqual({ b: "hit" });
  fireEvent.click(screen.getByRole("button", { name: "Resolve Success / Failure" }));
  expect(within(screen.getByRole("dialog")).getAllByRole("button", { name: "Success" })[0]).toHaveAttribute("aria-pressed", "true");
  expect(mockRoll).toHaveBeenCalledTimes(1);
});
it("edits application amounts independently, halves with integer division, and undoes HP and receipts", async () => {
  setup(); send("/r 13"); await screen.findByRole("region", { name: "Roll result: 13" });
  fireEvent.click(screen.getByRole("button", { name: "Apply Damage" }));
  const dialog = screen.getByRole("dialog", { name: "Apply Damage" });
  fireEvent.click(within(dialog).getByRole("checkbox", { name: "Guard" }));
  fireEvent.click(within(dialog).getByRole("checkbox", { name: "Scout" }));
  fireEvent.click(within(dialog).getByRole("button", { name: "Edit amount for Guard" }));
  fireEvent.click(within(dialog).getByRole("button", { name: "/2" }));
  expect(screen.getByRole("spinbutton", { name: "Amount for Guard" })).toHaveValue(6);
  fireEvent.click(within(dialog).getByRole("button", { name: "Apply Damage" }));
  await waitFor(() => expect(store.getState().encounter.present.actors.byId.b.hitPoints?.current).toBe(14));
  expect(store.getState().encounter.present.actors.byId.c.hitPoints?.current).toBe(7);
  expect(lastMessage().rolls![0].node.value).toBe(13);
  act(() => { store.dispatch(undoEncounterChange()); });
  expect(store.getState().encounter.present.rollApplications.allIds).toHaveLength(0);
  expect(store.getState().encounter.present.actors.byId.b.hitPoints?.current).toBe(20);
  act(() => { store.dispatch(redoEncounterChange()); });
  expect(store.getState().encounter.present.rollApplications.allIds).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: "Apply Damage" }));
  const again = screen.getByRole("dialog", { name: "Apply Damage" });
  fireEvent.click(within(again).getByRole("checkbox", { name: "Guard" }));
  fireEvent.click(within(again).getByRole("button", { name: "Apply Damage" }));
  expect(screen.getByRole("dialog", { name: "Apply this result again?" })).toBeInTheDocument();
});
it("saves and reorders Rollables in one step and launches from Status", async () => {
  const actor = store.getState().encounter.present.actors.byId.a;
  render(<Provider store={store}><ActorRollables actor={actor} /><LogPanel /></Provider>);
  fireEvent.click(screen.getByRole("button", { name: "Edit Rollables" }));
  fireEvent.click(screen.getByRole("combobox", { name: "Rollable to edit" }));
  fireEvent.click(screen.getByRole("button", { name: "Create new Rollable" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Rollable name" }), { target: { value: "Restore" } });
  fireEvent.change(screen.getByRole("textbox", { name: "Effect roll" }), { target: { value: "d6" } });
  fireEvent.click(screen.getByRole("combobox", { name: "Rollable to edit" }));
  fireEvent.click(screen.getByRole("button", { name: "Move Restore up" }));
  expect(screen.getByRole("combobox", { name: "Rollable to edit" })).toHaveAttribute("aria-expanded", "true");
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(store.getState().encounter.present.actors.byId.a.rollables!.allIds).toHaveLength(2));
  expect(store.getState().encounter.present.actors.byId.a.rollables!.allIds[1]).toBe("slash");
  expect(store.getState().encounter.past).toHaveLength(1);
});

it("opens Status-launched resolution even when no Log panel is mounted", async () => {
  const { RollResolutionHost } = await import("@ui/dice/RollResolutionHost");
  const actor = store.getState().encounter.present.actors.byId.a;
  render(<StrictMode><Provider store={store}><RollResolutionHost /><ActorRollables actor={actor} /></Provider></StrictMode>);
  fireEvent.click(screen.getByRole("button", { name: "Slash" }));
  const dialog = await screen.findByRole("dialog", { name: "Check result: 16" });
  fireEvent.click(within(dialog).getByRole("button", { name: "Success" }));
  await waitFor(() => expect(lastMessage().invocation?.phase).toBe("resolved"));
  expect(lastMessage().rolls).toHaveLength(2);
});

it("fires action audio at launch before the check finishes, independently of movement trigger switches", async () => {
  const state = diceEncounter();
  state.audioCueGroups = { allIds: ["g"], byId: { g: { id: "g", name: "Attack", section: "actor", repeat: false } } };
  state.audioCues = { allIds: ["cue"], byId: { cue: { id: "cue", libraryNodeId: "asset", placement: { type: "group", groupId: "g" }, type: "effect", volume: 50, repeat: false, repeatDelay: { minimumDelaySeconds: 0, maximumDelaySeconds: 0 }, triggers: [], triggersEnabled: false } } };
  state.actors.byId.a.rollables!.byId.slash.audioGroupId = "g";
  store.dispatch(loadEncounterState(state));
  let complete!: (rolls: ReturnType<typeof evaluateDice>[]) => void;
  mockRoll.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
  const listener = vi.fn(); window.addEventListener("combat-zone:audio-trigger", listener);
  try {
    setup(); send('@"Goblin Chief"/Slash');
    expect(listener).toHaveBeenCalledOnce(); expect(store.getState().encounter.present.chatMessages.allIds).toHaveLength(0);
    expect((listener.mock.calls[0][0] as CustomEvent).detail[0]).toMatchObject({ cueId: "cue", explicit: true });
    await act(async () => complete([evaluateDice("d20+5", () => .5)]));
    expect(listener).toHaveBeenCalledOnce();
  } finally { window.removeEventListener("combat-zone:audio-trigger", listener); }
});

it.each(["", "d20"])("None effects roll normally and never offer log application controls (check: %s)", async checkFormula => {
  const state = diceEncounter();
  Object.assign(state.actors.byId.a.rollables!.byId.slash, { effectKind: "none", checkFormula, effectFormula: "13" });
  store.dispatch(loadEncounterState(state));
  setup(); send('@"Goblin Chief"/Slash -> @Guard');
  if (checkFormula) {
    const dialog = await screen.findByRole("dialog", { name: "Check result: 11" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Success" }));
  }
  await screen.findByRole("region", { name: "Roll result: 13" });
  expect(lastMessage().rolls?.at(-1)?.node.value).toBe(13);
  expect(screen.queryByRole("button", { name: "Apply Healing" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Apply Damage" })).not.toBeInTheDocument();
  expect(store.getState().encounter.present.rollApplications.allIds).toEqual([]);
});
