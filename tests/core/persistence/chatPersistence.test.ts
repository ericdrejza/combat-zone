import { describe, expect, it } from "vitest";
import { createEncounterState } from "@core/encounter/createEncounterState";
import { assertEncounterState, migrateEncounterState, parseExportEnvelope } from "@core/persistence/envelope";
import { InMemoryWorkspaceRepository } from "@core/persistence/memoryRepository";
import { loadEncounterState } from "@store/encounterSlice";
import { store } from "@store/store";

function encounter() {
  const state = createEncounterState({ id: "chat", name: "Chat" });
  state.chatMessages = { allIds: ["m1"], byId: { m1: { id: "m1", timestamp: 42, message: "Hello\nWorld",
    sender: { id: "game-master", name: "Game Master", color: "#abcdef" } } } };
  return state;
}
describe("saved chat", () => {
  it("round trips messages through repository, recovery draft, and export/import with fresh load history", async () => {
    const repo = new InMemoryWorkspaceRepository();
    const original = encounter();
    await repo.createEncounter(original);
    await repo.saveRecoveryDraft(original);
    expect((await repo.getRecoveryDraft())?.state).toEqual(original);
    const exported = parseExportEnvelope(JSON.parse(JSON.stringify(await repo.exportEncounter(original.id))));
    const imported = new InMemoryWorkspaceRepository();
    if (exported.kind !== "encounter-export") throw new Error("Wrong envelope");
    await imported.createEncounter(exported.encounter);
    const workspace = await repo.exportWorkspace();
    await imported.importWorkspace(workspace, "overwrite");
    const loaded = await imported.getEncounter(original.id);
    expect(loaded?.state).toEqual(original);
    store.dispatch(loadEncounterState(loaded!.state));
    expect(store.getState().encounter.past).toEqual([]);
    expect(store.getState().encounter.future).toEqual([]);
  });
  it("migrates version 32 with an empty chat and rejects missing chat in the current version", () => {
    const legacy = { ...encounter(), schemaVersion: 32 } as Record<string, unknown>;
    delete legacy.chatMessages;
    const migrated = migrateEncounterState(legacy);
    assertEncounterState(migrated);
    expect(migrated.chatMessages).toEqual({ byId: {}, allIds: [] });
    expect(() => assertEncounterState({ ...encounter(), chatMessages: undefined })).toThrow(/chat/i);
    expect(() => assertEncounterState({ ...encounter(), schemaVersion: 999 })).toThrow(/unsupported/);
  });
  it.each(["sender", "message", "timestamp", "references"])("rejects invalid %s and preserves the last valid record", async field => {
    const repo = new InMemoryWorkspaceRepository();
    const original = encounter();
    const record = await repo.createEncounter(original);
    const invalid = structuredClone(original);
    const entry = invalid.chatMessages.byId.m1 as unknown as Record<string, unknown>;
    if (field === "references") invalid.chatMessages.allIds.push("missing");
    else entry[field] = field === "message" ? "   " : null;
    await expect(repo.saveEncounter(invalid, { expectedRevision: record.revision })).rejects.toThrow(/chat/i);
    expect((await repo.getEncounter(original.id))?.state).toEqual(original);
  });
  it("checks revisions before overwriting saved messages", async () => {
    const repo = new InMemoryWorkspaceRepository();
    const original = encounter();
    const record = await repo.createEncounter(original);
    const next = structuredClone(original);
    next.chatMessages.byId.m1.message = "Updated";
    await repo.saveEncounter(next, { expectedRevision: record.revision });
    await expect(repo.saveEncounter(original, { expectedRevision: record.revision })).rejects.toThrow(/revision/i);
    expect((await repo.getEncounter(original.id))?.state).toEqual(next);
  });
});
