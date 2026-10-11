import { createEncounterState } from '@core/encounter/createEncounterState';
import { assertEncounterState, migrateEncounterState, parseExportEnvelope } from '@core/persistence/envelope';
import { EXPORT_SCHEMA_VERSION } from '@core/persistence/types';
import { InMemoryWorkspaceRepository } from '@core/persistence/memoryRepository';
import { hydrateEncounterRecord } from '@core/persistence/hydratePersistedRecords';
import { createEmptyLibraryState } from '@core/persistence/memoryRepository';
import { CLOUD_RECORD_SCHEMA_VERSION, validateEncounter } from '@combat-zone/firebase-api';

const cloud = (state: unknown) => ({ schemaVersion: CLOUD_RECORD_SCHEMA_VERSION,
  encounterId: 'iso', folderId: null, assetIds: [], state });

it.each(['square', 'hex-flat', 'hex-pointy'] as const)('migrates schema 22 %s documents without changing geometry', type => {
  const current = createEncounterState({ id: 'iso', name: 'Iso' });
  current.grid = { ...current.grid, type, rotation: 17, origin: { x: 33, y: 51 } };
  const old = { ...current, schemaVersion: 22 }, original = structuredClone(old);
  expect(migrateEncounterState(old)).toEqual(current);
  expect(old).toEqual(original);
  expect(() => validateEncounter(cloud(old))).not.toThrow();
});

it('migrates legacy schema 21 mode fields into the current independent rules', () => {
  const current = createEncounterState({ id: 'iso', name: 'Iso' });
  const { movementRules: _rules, ...rest } = current;
  const old = { ...rest, schemaVersion: 21, movementStrategy: 'free' };
  const migrated = migrateEncounterState(old);
  assertEncounterState(migrated);
  expect(migrated.schemaVersion).toBe(24);
  expect(migrated.movementRules).toMatchObject({ zoneLocked: false, snapToGrid: false });
  expect(migrated).not.toHaveProperty('movementStrategy');
});

it('round trips isometric encounters through exports, hydration, repository writes, and cloud validation', async () => {
  const state = createEncounterState({ id: 'iso', name: 'Iso' });
  state.grid = { ...state.grid, type: 'isometric', rotation: 31, visible: true };
  const envelope = { schemaVersion: EXPORT_SCHEMA_VERSION, kind: 'encounter-export', exportedAt: 1,
    encounter: state, library: createEmptyLibraryState() };
  expect(parseExportEnvelope(JSON.parse(JSON.stringify(envelope)))).toEqual(envelope);
  const repo = new InMemoryWorkspaceRepository(), record = await repo.createEncounter(state);
  expect(hydrateEncounterRecord(record)).toEqual(record);
  expect((await repo.getEncounter(state.id))?.state).toEqual(state);
  expect(validateEncounter(cloud(JSON.parse(JSON.stringify(state))))).toMatchObject({ state });
  await repo.saveEncounter(state, { expectedRevision: record.revision });
  await expect(repo.saveEncounter(state, { expectedRevision: record.revision })).rejects.toThrow(/revision/i);
  const latest = (await repo.getEncounter(state.id))!;
  await expect(repo.saveEncounter({ ...state, grid: { ...state.grid, cellSize: -1 } }, { expectedRevision: latest.revision })).rejects.toThrow();
  expect((await repo.getEncounter(state.id))!.state).toEqual(state);
});

it('rejects isometric data claiming an older schema and unsupported newer schemas', () => {
  const state = createEncounterState({ id: 'iso', name: 'Iso' });
  state.grid.type = 'isometric';
  expect(() => migrateEncounterState({ ...state, schemaVersion: 22 })).toThrow();
  expect(() => validateEncounter(cloud({ ...state, schemaVersion: 22 }))).toThrow(/spatial/);
  expect(() => assertEncounterState({ ...state, schemaVersion: 25 })).toThrow(/unsupported/);
  expect(() => validateEncounter(cloud({ ...state, schemaVersion: 25 }))).toThrow(/unsupported/);
});

it('preserves schema 23 default projection and persists explicit angles only in schema 24', () => {
  const current = createEncounterState({ id: 'iso', name: 'Iso' }); current.grid.type = 'isometric';
  const old = { ...current, schemaVersion: 23 };
  expect(migrateEncounterState(old)).toEqual(current);
  expect(() => validateEncounter(cloud(old))).not.toThrow();
  const angled = { ...current, grid: { ...current.grid, isometricAngle: 30 } };
  expect(() => assertEncounterState(angled)).not.toThrow();
  expect(() => validateEncounter(cloud(angled))).not.toThrow();
  expect(() => migrateEncounterState({ ...angled, schemaVersion: 23 })).toThrow();
  for (const isometricAngle of [0, 46, NaN, Infinity]) {
    const invalid = { ...current, grid: { ...current.grid, isometricAngle } };
    expect(() => assertEncounterState(invalid)).toThrow();
    expect(() => validateEncounter(cloud(invalid))).toThrow();
  }
});
