import type { Rollable } from "@core/dice/types";
import { expect, it } from "vitest";
import { diceEncounter } from "./fixtures";
import { evaluateDice } from "@core/dice/evaluate";
import { resolveInvocation } from "@core/dice/resolveInvocation";
import { assertEncounterState, migrateEncounterState } from "@core/persistence/envelope";
import { InMemoryWorkspaceRepository } from "@core/persistence/memoryRepository";
import { validateEncounter, CLOUD_RECORD_SCHEMA_VERSION } from "@combat-zone/firebase-api";

function stateWithChecks() {
  const state = diceEncounter(); state.actors.byId.a.rollables!.byId.slash.checkRollMode = 'ask';
  const invocation = resolveInvocation(state, '@"Goblin Chief"/Slash -> [@Guard, @Scout]');
  invocation.checkRollMode = 'perTarget';
  const rolls = invocation.targets.map((target, index) => ({ ...evaluateDice(String(index + 10)), role: 'check' as const, targetId: target.id }));
  state.chatMessages = { allIds: ['m'], byId: { m: { id: 'm', timestamp: 1, sender: { id: 'gm', name: 'GM', color: null }, message: '@"Goblin Chief"/Slash -> [@Guard, @Scout]', invocation, rolls } } };
  return state;
}
const payload = (state: ReturnType<typeof diceEncounter>) => ({ schemaVersion: CLOUD_RECORD_SCHEMA_VERSION, encounterId: state.id, folderId: null, assetIds: [], state: JSON.parse(JSON.stringify(state)) });
it('round trips actual choice and target associations through save/recovery/export/import and cloud validation', async () => {
  const state = stateWithChecks(); assertEncounterState(state); expect(validateEncounter(payload(state)).state).toEqual(JSON.parse(JSON.stringify(state)));
  const repo = new InMemoryWorkspaceRepository(); await repo.createEncounter(state); await repo.saveRecoveryDraft(state);
  expect((await repo.getEncounter(state.id))?.state).toEqual(state); expect((await repo.getRecoveryDraft())?.state).toEqual(state);
  const imported = new InMemoryWorkspaceRepository(); await imported.importWorkspace(await repo.exportWorkspace(), 'overwrite');
  await imported.importWorkspace(await repo.exportWorkspace(), 'merge');
  const records = await imported.listEncounters(); expect(records).toHaveLength(2);
  for (const record of records) expect(record.state.chatMessages).toEqual(state.chatMessages);
});
it('migrates schema 36 actor definitions and historical invocation snapshots to shared checks', () => {
  const state = stateWithChecks(); const message = state.chatMessages.byId.m;
  delete (state.actors.byId.a.rollables!.byId.slash as Partial<Rollable>).checkRollMode;
  delete (message.invocation!.rollable as Partial<Rollable>).checkRollMode;
  delete (message.invocation as Partial<NonNullable<typeof message.invocation>>).checkRollMode;
  message.rolls = [evaluateDice('16')]; message.rolls[0].role = 'check';
  const legacy = { ...state, schemaVersion: 36 }; const original = structuredClone(legacy);
  expect(validateEncounter(payload(legacy as typeof state)).state).toEqual(JSON.parse(JSON.stringify(legacy)));
  const migrated = migrateEncounterState(legacy); assertEncounterState(migrated);
  expect(migrated.actors.byId.a.rollables!.byId.slash.checkRollMode).toBe('shared');
  expect(migrated.chatMessages.byId.m.invocation).toMatchObject({ checkRollMode: 'shared', rollable: { checkRollMode: 'shared' } });
  expect(migrated.chatMessages.byId.m.rolls).toEqual(message.rolls); expect(legacy).toEqual(original);
});
it.each(['setting', 'actual', 'missing-target', 'duplicate-target', 'unknown-target', 'effect-target'])(
  'rejects invalid %s without replacing the last valid record locally or at the cloud boundary', async field => {
    const state = stateWithChecks(); const repo = new InMemoryWorkspaceRepository(); const record = await repo.createEncounter(state);
    const invalid = structuredClone(state); const message = invalid.chatMessages.byId.m;
    if (field === 'setting') Object.assign(invalid.actors.byId.a.rollables!.byId.slash, { checkRollMode: 'invalid' });
    if (field === 'actual') Object.assign(message.invocation!, { checkRollMode: 'ask' });
    if (field === 'missing-target') delete message.rolls![0].targetId;
    if (field === 'duplicate-target') message.rolls![1].targetId = message.rolls![0].targetId;
    if (field === 'unknown-target') message.rolls![0].targetId = 'other';
    if (field === 'effect-target') message.rolls![0].role = 'effect';
    await expect(repo.saveEncounter(invalid, { expectedRevision: record.revision })).rejects.toThrow();
    expect(() => validateEncounter(payload(invalid))).toThrow();
    expect((await repo.getEncounter(state.id))?.state).toEqual(state);
  });
