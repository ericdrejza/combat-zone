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
