import { act, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { expect, it } from "vitest";
import { createEncounterState } from "@core/encounter/createEncounterState";
import { InMemoryWorkspaceRepository } from "@core/persistence";
import { sendChatMessage, deleteChatMessage, resetEncounterState } from "@store/encounterSlice";
import { store } from "@store/store";
import { PersistenceProvider, usePersistence } from "@ui/persistence/PersistenceProvider";

function Probe() {
  return <span>{usePersistence().initialized ? "Ready" : "Loading"}</span>;
}

it("autosaves sent and deleted chat without adding undo history", async () => {
  const repository = new InMemoryWorkspaceRepository();
  const state = createEncounterState({ id: "chat-autosave", name: "Chat" });
  await repository.initialize();
  await repository.createEncounter(state, "encounters-root");
  const manifest = await repository.getManifest();
  await repository.saveManifest({ ...manifest, activeEncounterId: state.id, revision: 1 });
  store.dispatch(resetEncounterState());
  render(<Provider store={store}><PersistenceProvider repository={repository}><Probe /></PersistenceProvider></Provider>);
  await screen.findByText("Ready");
  act(() => { store.dispatch(sendChatMessage({ id: "saved", timestamp: 42, message: "Saved",
    sender: { id: "game-master", name: "Game Master", color: null } })); });
  await waitFor(async () => {
    expect((await repository.getEncounter(state.id))?.state.chatMessages.allIds).toEqual(["saved"]);
  }, { timeout: 2000 });
  act(() => { store.dispatch(deleteChatMessage("saved")); });
  await waitFor(async () => {
    expect((await repository.getEncounter(state.id))?.state.chatMessages.allIds).toEqual([]);
  }, { timeout: 2000 });
  expect(store.getState().encounter.past).toEqual([]);
  expect(store.getState().encounter.future).toEqual([]);
});

it("autosaves structured results and pending-resolution decisions outside encounter history", async () => {
  const { diceEncounter } = await import("@tests/core/dice/fixtures");
  const { evaluateDice } = await import("@core/dice/evaluate");
  const { resolveInvocation } = await import("@core/dice/resolveInvocation");
  const { setChatRollDecisions, resolveChatRoll } = await import("@store/encounterSlice");
  const repository = new InMemoryWorkspaceRepository(); const state = diceEncounter();
  await repository.initialize(); await repository.createEncounter(state, "encounters-root");
  const manifest = await repository.getManifest();
  await repository.saveManifest({ ...manifest, activeEncounterId: state.id, revision: 1 });
  render(<Provider store={store}><PersistenceProvider repository={repository}><Probe /></PersistenceProvider></Provider>);
  await screen.findByText("Ready");
  const invocation = resolveInvocation(state, '@"Goblin Chief"/Slash -> @Guard');
  act(() => { store.dispatch(sendChatMessage({ id: "roll", timestamp: 42, message: "Attack", sender: { id: "gm", name: "GM", color: null }, invocation, rolls: [evaluateDice("d20", () => .5)] })); });
  act(() => { store.dispatch(setChatRollDecisions({ id: "roll", decisions: { b: "hit" } })); });
  await waitFor(async () => expect((await repository.getEncounter(state.id))?.state.chatMessages.byId.roll.invocation?.decisions).toEqual({ b: "hit" }), { timeout: 2000 });
  act(() => { store.dispatch(resolveChatRoll({ id: "roll", invocation: { ...invocation, decisions: { b: "hit" }, phase: "resolved" }, rolls: [evaluateDice("d6", () => .5)] })); });
  await waitFor(async () => expect((await repository.getEncounter(state.id))?.state.chatMessages.byId.roll.rolls).toHaveLength(2), { timeout: 2000 });
  expect(store.getState().encounter.past).toEqual([]);
});
