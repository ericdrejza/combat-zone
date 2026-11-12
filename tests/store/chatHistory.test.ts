import { afterEach, describe, expect, it } from "vitest";
import { createEncounterState } from "@core/encounter/createEncounterState";
import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { InMemoryWorkspaceRepository } from "@core/persistence/memoryRepository";
import reducer, { clearChatMessages, commitEncounterChange, deleteChatMessage, loadEncounterState,
  redoEncounterChange, sendChatMessage, undoEncounterChange } from "@store/encounterSlice";
import { setPersistenceWritable } from "@store/persistenceWriteGuardMiddleware";
import { store } from "@store/store";

const message = (id: string) => ({ id, message: id, timestamp: 42,
  sender: { id: "game-master", name: "Game Master", color: null } });
const initial = () => reducer(undefined, loadEncounterState(createEncounterState({ id: "chat-history", name: "Before" })));
function rename(state: ReturnType<typeof initial>, name: string) {
  return reducer(state, commitEncounterChange({ action: createEncounterActionRecord("encounter.rename"),
    nextEncounter: { ...state.present, name } }));
}
afterEach(() => setPersistenceWritable(true));

describe("chat outside encounter history", () => {
  it("preserves sent messages when undoing and redoing older encounter edits", () => {
    const edited = rename(initial(), "After");
    const sent = reducer(edited, sendChatMessage(message("new")));
    expect(sent.past).toBe(edited.past);
    expect(sent.future).toBe(edited.future);
    const undone = reducer(sent, undoEncounterChange());
    expect(undone.present.name).toBe("Before");
    expect(undone.present.chatMessages).toEqual(sent.present.chatMessages);
    const redone = reducer(undone, redoEncounterChange());
    expect(redone.present.name).toBe("After");
    expect(redone.present.chatMessages).toEqual(sent.present.chatMessages);
  });
  it.each(["delete", "clear"])("does not resurrect messages after %s with past and future snapshots", operation => {
    const sent = reducer(initial(), sendChatMessage(message("old")));
    const undone = reducer(rename(sent, "After"), undoEncounterChange());
    const removed = reducer(undone, operation === "delete" ? deleteChatMessage("old") : clearChatMessages());
    expect(removed.past).toBe(undone.past);
    expect(removed.future).toBe(undone.future);
    const redone = reducer(removed, redoEncounterChange());
    expect(redone.present.name).toBe("After");
    expect(redone.present.chatMessages.allIds).toEqual([]);
    expect(reducer(redone, undoEncounterChange()).present.chatMessages.allIds).toEqual([]);
  });
  it("sending while an encounter edit is undone preserves redo", () => {
    const undone = reducer(rename(initial(), "After"), undoEncounterChange());
    const sent = reducer(undone, sendChatMessage(message("new")));
    expect(sent.future).toBe(undone.future);
    const redone = reducer(sent, redoEncounterChange());
    expect(redone.present.name).toBe("After");
    expect(redone.present.chatMessages.allIds).toEqual(["new"]);
  });
  it("ignores stale chat in encounter commits prepared before chat changed", () => {
    const before = initial();
    const sent = reducer(before, sendChatMessage(message("new")));
    const committed = reducer(sent, commitEncounterChange({ action: createEncounterActionRecord("encounter.rename"),
      nextEncounter: { ...before.present, name: "After" } }));
    expect(committed.present.chatMessages.allIds).toEqual(["new"]);
    const removed = reducer(committed, deleteChatMessage("new"));
    const staleCommit = reducer(removed, commitEncounterChange({ action: createEncounterActionRecord("encounter.rename"),
      nextEncounter: { ...committed.present, name: "Again" } }));
    expect(staleCommit.present.chatMessages.allIds).toEqual([]);
  });
  it("blocks chat mutations centrally in read-only tabs", () => {
    store.dispatch(loadEncounterState(initial().present));
    store.dispatch(sendChatMessage(message("keep")));
    setPersistenceWritable(false);
    const before = store.getState().encounter;
    store.dispatch(sendChatMessage(message("blocked")));
    store.dispatch(deleteChatMessage("keep"));
    store.dispatch(clearChatMessages());
    expect(store.getState().encounter).toBe(before);
  });
  it("saves sent and deleted messages through the repository without history", async () => {
    const repo = new InMemoryWorkspaceRepository();
    const sent = reducer(initial(), sendChatMessage(message("saved")));
    const record = await repo.createEncounter(sent.present);
    expect((await repo.getEncounter(record.id))?.state.chatMessages).toEqual(sent.present.chatMessages);
    const deleted = reducer(sent, deleteChatMessage("saved"));
    await repo.saveEncounter(deleted.present, { expectedRevision: record.revision });
    expect((await repo.getEncounter(record.id))?.state.chatMessages.allIds).toEqual([]);
    expect(deleted.past).toEqual([]);
  });
});
