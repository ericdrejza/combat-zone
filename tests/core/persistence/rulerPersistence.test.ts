import { createEncounterState } from '@core/encounter/createEncounterState';
import { saveRuler } from '@core/measurement/rulerMutations';
import type { LockedRuler } from '@core/measurement/types';
import { assertEncounterState, migrateEncounterState, parseExportEnvelope } from '@core/persistence/envelope';
import { InMemoryWorkspaceRepository } from '@core/persistence/memoryRepository';
import { validateEncounter, CLOUD_RECORD_SCHEMA_VERSION } from '@combat-zone/firebase-api';

const artifact = (id = 'ruler', shape: LockedRuler['options']['shape'] = 'cone'): LockedRuler => ({ id, name: 'Blast', points: [{ x: 160, y: 160 }, { x: 320, y: 320 }], options: { shape, angle: 45 }, color: '#abcdef', opacity: 0.65 });
function fixture() {
  return (['path', 'line', 'circle', 'cone', 'rectangle'] as const).reduce((state, shape) => saveRuler(state, artifact(shape, shape)), createEncounterState({ id: 'rulers', name: 'Rulers' }));
}
const cloud = (state: unknown) => validateEncounter({ schemaVersion: CLOUD_RECORD_SCHEMA_VERSION, encounterId: 'rulers', folderId: null, assetIds: [], state } as never);
it('migrates schema 28 to an empty normalized ruler collection without changing its source or other facts', () => {
  const legacy = { ...fixture(), schemaVersion: 28 } as Record<string, unknown>; delete legacy.rulers;
  const before = structuredClone(legacy), migrated = migrateEncounterState(legacy);
  assertEncounterState(migrated); expect(migrated.schemaVersion).toBe(29); expect(migrated.rulers).toEqual({ allIds: [], byId: {} });
  expect({ ...migrated, schemaVersion: 28, rulers: undefined }).toEqual({ ...legacy, rulers: undefined }); expect(legacy).toEqual(before);
});
it('round trips all ruler shapes, names, appearance, and stable IDs through repository, recovery, export and cloud', async () => {
  const state = fixture(), repository = new InMemoryWorkspaceRepository();
  await repository.createEncounter(state, 'encounters-root'); await repository.saveRecoveryDraft(state);
  expect((await repository.getEncounter(state.id))?.state).toEqual(state);
  expect((await repository.getRecoveryDraft())?.state).toEqual(state);
  const envelope = await repository.exportEncounter(state.id);
  expect(parseExportEnvelope(JSON.parse(JSON.stringify(envelope)))).toEqual(envelope);
  expect(cloud(JSON.parse(JSON.stringify(state))).state).toEqual(state);
  const duplicate = await repository.duplicateEncounter(state.id);
  expect(duplicate.state.rulers).toEqual(state.rulers);
});
it.each([
  { points: [{ x: 1, y: 2 }] }, { points: [{ x: NaN, y: 2 }, { x: 3, y: 4 }] },
  { points: [{ x: 1, y: 2 }, { x: 3, y: Infinity }] }, { options: { shape: 'invalid' } },
  { options: { shape: 'cone', angle: 181 } }, { options: { shape: 'cone', angle: -1 } },
  { name: 42 }, { color: 'red' }, { opacity: -0.1 }, { opacity: 1.1 }
])('rejects invalid ruler data %j locally/cloud and preserves the last valid record', async patch => {
  const repository = new InMemoryWorkspaceRepository(), state = fixture(), record = await repository.createEncounter(state);
  const invalid = { ...state, rulers: { ...state.rulers, byId: { ...state.rulers.byId, cone: { ...state.rulers.byId.cone, ...patch } } } };
  expect(() => assertEncounterState(invalid)).toThrow(/rulers/i); expect(() => cloud(invalid)).toThrow();
  await expect(repository.saveEncounter(invalid as typeof state, { expectedRevision: record.revision })).rejects.toThrow();
  expect((await repository.getEncounter(state.id))?.state).toEqual(state);
});
it.each([
  { byId: {}, allIds: ['missing'] }, { byId: { ruler: artifact() }, allIds: ['ruler', 'ruler'] },
  { byId: { wrong: artifact() }, allIds: ['wrong'] }, { byId: { ruler: artifact() }, allIds: [] }
])('rejects invalid normalized ruler IDs %j', rulers => {
  const state = { ...fixture(), rulers };
  expect(() => assertEncounterState(state)).toThrow(/rulers/i); expect(() => cloud(state)).toThrow(/ruler/i);
});
it('preserves rulers on revision conflicts and rejects unsupported newer versions', async () => {
  const state = fixture(), repository = new InMemoryWorkspaceRepository();
  await repository.createEncounter(state);
  await expect(repository.saveEncounter(saveRuler(state, { ...artifact('cone'), name: 'Conflict' }), { expectedRevision: 10 })).rejects.toThrow();
  expect((await repository.getEncounter(state.id))?.state).toEqual(state);
  expect(() => assertEncounterState(migrateEncounterState({ ...state, schemaVersion: 30 }))).toThrow(/unsupported/);
  expect(() => cloud({ ...state, schemaVersion: 30 })).toThrow(/unsupported/);
});
it('retains ruler IDs within imported encounters, backs up overwrite state, and rejects invalid imports atomically', async () => {
  const source = new InMemoryWorkspaceRepository(), destination = new InMemoryWorkspaceRepository(), state = fixture();
  await source.createEncounter(state, 'encounters-root'); await destination.createEncounter(state, 'encounters-root');
  const envelope = await source.exportWorkspace();
  await destination.importWorkspace(envelope, 'merge');
  const imported = (await destination.listEncounters()).find(record => record.id !== state.id)!;
  expect(imported.state.id).toBe(imported.id); expect(imported.state.rulers).toEqual(state.rulers);
  const before = await destination.exportWorkspace(); await destination.saveBackup(before);
  await destination.importWorkspace(envelope, 'overwrite');
  expect((await destination.getLatestBackup())?.workspace.encounters.find(record => record.id === imported.id)?.state.rulers).toEqual(state.rulers);
  const valid = await destination.exportWorkspace(), invalid = structuredClone(valid);
  invalid.workspace.encounters[0].state.rulers.allIds.push('missing');
  await expect(destination.importWorkspace(invalid, 'overwrite')).rejects.toThrow(/rulers/i);
  expect((await destination.getEncounter(state.id))?.state.rulers).toEqual(state.rulers);
});
