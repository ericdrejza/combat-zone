import { snapshotReferences } from "@core/dice/referenceSnapshots";
import { describe, it, expect } from "vitest";
import { diceEncounter } from "./fixtures";
import { evaluateDice } from "@core/dice/evaluate";
import { resolveInvocation } from "@core/dice/resolveInvocation";
import { InMemoryWorkspaceRepository } from "@core/persistence/memoryRepository";
import { migrateEncounterState, assertEncounterState, parseExportEnvelope } from "@core/persistence/envelope";
import { validateEncounter, CLOUD_RECORD_SCHEMA_VERSION } from "@combat-zone/firebase-api";
function savedDice() {
  const state = diceEncounter();
  const result = evaluateDice("d6!~2", () => .99);
  state.chatMessages = { allIds: ["m"], byId: { m: { id: "m", timestamp: 42, message: "attack @Guard", references: snapshotReferences(state, "attack @Guard"), sender: { id: "gm", name: "GM", color: null }, rolls: [result], invocation: resolveInvocation(state, '@"Goblin Chief"/Slash -> @Guard') } } };
  state.rollApplications = { allIds: ["receipt"], byId: { receipt: { id: "receipt", resultId: result.id, actorId: "b", kind: "damage", amount: 3 } } };
  return state;
}
describe("durable dice documents", () => {
  it("round trips formulas, individual faces, caps, pending snapshots and receipts through recovery/export/import", async () => {
    const repo = new InMemoryWorkspaceRepository(); const state = savedDice();
    await repo.createEncounter(state); await repo.saveRecoveryDraft(state);
    expect((await repo.getRecoveryDraft())?.state).toEqual(state);
    const envelope = parseExportEnvelope(JSON.parse(JSON.stringify(await repo.exportEncounter(state.id))));
    if (envelope.kind !== "encounter-export") throw new Error("Wrong envelope");
    expect(envelope.encounter).toEqual(state);
    const other = new InMemoryWorkspaceRepository();
    await other.importWorkspace(await repo.exportWorkspace(), "overwrite");
    expect((await other.getEncounter(state.id))?.state).toEqual(state);
    const merged = await other.importWorkspace(await repo.exportWorkspace(), "merge");
    expect(merged).toBeDefined();
    const records = await other.listEncounters();
    expect(records).toHaveLength(2);
    for (const record of records) expect(record.state.chatMessages.byId.m.invocation?.targets[0].id).toBe("b");
  });
  it("migrates plain chat and legacy actors without manufacturing roll outcomes", () => {
    const legacy = { ...diceEncounter(), schemaVersion: 33 } as Record<string, unknown>; delete legacy.rollApplications;
    const migrated = migrateEncounterState(legacy); assertEncounterState(migrated);
    expect(migrated.rollApplications).toEqual({ allIds: [], byId: {} }); expect(migrated.chatMessages.allIds).toHaveLength(0);
  });
  it.each(["node", "auxiliary", "cap", "invocation", "receipt", "audio", "reference"])("rejects malformed %s before replacing the last valid record", async field => {
    const state = savedDice(); const repo = new InMemoryWorkspaceRepository(); const record = await repo.createEncounter(state);
    const invalid = structuredClone(state);
    if (field === "node") invalid.chatMessages.byId.m.rolls![0].node.value = Infinity;
    if (field === "auxiliary") invalid.chatMessages.byId.m.rolls![0].auxiliary = [{ type: "roll", value: Infinity, valid: true }];
    if (field === "cap") (invalid.chatMessages.byId.m.rolls![0] as unknown as Record<string, unknown>).capped = "yes";
    if (field === "invocation") invalid.chatMessages.byId.m.invocation!.rollable.checkFormula = "";
    if (field === "invocation") invalid.chatMessages.byId.m.invocation!.rollable.effectFormula = "";
    if (field === "receipt") invalid.rollApplications.byId.receipt.amount = -1;
    if (field === "reference") invalid.chatMessages.byId.m.references![0].end = 1000;
    if (field === "audio") invalid.actors.byId.a.rollables!.byId.slash.audioGroupId = "missing";
    await expect(repo.saveEncounter(invalid, { expectedRevision: record.revision })).rejects.toThrow();
    expect((await repo.getEncounter(state.id))?.state).toEqual(state);
  });
  it("uses the same structural dice validation at the cloud boundary", () => {
    const state = savedDice();
    const payload = { schemaVersion: CLOUD_RECORD_SCHEMA_VERSION, encounterId: state.id, folderId: null, state: JSON.parse(JSON.stringify(state)), assetIds: [] };
    expect(validateEncounter(payload).state).toEqual(state);
    payload.state.chatMessages.byId.m.rolls[0].node.valid = "yes";
    expect(() => validateEncounter(payload)).toThrow(/Dice/);
  });
  it("preserves revision protection for saved rolls", async () => {
    const repo = new InMemoryWorkspaceRepository(); const state = savedDice(); const record = await repo.createEncounter(state);
    await repo.saveEncounter({ ...state, name: "New" }, { expectedRevision: record.revision });
    await expect(repo.saveEncounter(state, { expectedRevision: record.revision })).rejects.toThrow(/revision/i);
    expect((await repo.getEncounter(state.id))?.state.name).toBe("New");
  });
});

it("round trips None effects through repository and cloud validation", async () => {
  const state = diceEncounter();
  state.actors.byId.a.rollables!.byId.slash.effectKind = "none";
  const repo = new InMemoryWorkspaceRepository(); await repo.createEncounter(state);
  expect((await repo.getEncounter(state.id))?.state.actors.byId.a.rollables!.byId.slash.effectKind).toBe("none");
  expect(validateEncounter({ schemaVersion: CLOUD_RECORD_SCHEMA_VERSION, encounterId: state.id, folderId: null, assetIds: [], state: JSON.parse(JSON.stringify(state)) }).state).toEqual(state);
  state.actors.byId.a.rollables!.byId.slash.effectFormula = "";
  expect(() => assertEncounterState(state)).toThrow();
});

it("migrates check-only actors and historical invocations without changing their roll or making it applicable", () => {
  const legacy = savedDice();
  const rollable = legacy.actors.byId.a.rollables!.byId.slash;
  Object.assign(rollable, { checkFormula: "d20+5", checkRollMode: "shared", effectFormula: "" });
  const message = legacy.chatMessages.byId.m;
  message.invocation = { ...message.invocation!, rollable: { ...rollable }, phase: "resolved" };
  const result = evaluateDice("d20+5", () => .5); result.role = "check"; message.rolls = [result];
  const original = structuredClone(legacy);
  const legacyState = { ...legacy, schemaVersion: 34 };
  expect(validateEncounter({ schemaVersion: CLOUD_RECORD_SCHEMA_VERSION, encounterId: legacy.id, folderId: null, assetIds: [], state: JSON.parse(JSON.stringify(legacyState)) }).state).toEqual(legacyState);
  const migrated = migrateEncounterState({ ...legacy, schemaVersion: 34 }); assertEncounterState(migrated);
  expect(migrated.schemaVersion).toBe(37);
  expect(migrated.actors.byId.a.rollables!.byId.slash).toMatchObject({ checkFormula: "", checkRollMode: "shared", effectFormula: "d20+5", effectKind: "none" });
  expect(migrated.chatMessages.byId.m.invocation!.rollable).toEqual(migrated.actors.byId.a.rollables!.byId.slash);
  expect(migrated.chatMessages.byId.m.rolls).toEqual(message.rolls);
  expect(legacy).toEqual(original);
  expect(() => assertEncounterState({ ...legacy, schemaVersion: 35 })).toThrow();
});

it("migrates schema 35 without inventing historical reference colors", () => {
  const state = savedDice(); delete state.chatMessages.byId.m.references;
  const migrated = migrateEncounterState({ ...state, schemaVersion: 35 });
  assertEncounterState(migrated);
  expect(migrated.schemaVersion).toBe(37);
  expect(migrated.chatMessages).toEqual(state.chatMessages);
  expect(() => assertEncounterState(migrateEncounterState({ ...state, schemaVersion: 38 }))).toThrow();
});
