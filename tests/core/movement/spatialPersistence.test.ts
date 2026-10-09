import { createEncounterState } from '@core/encounter/createEncounterState';
import { createActor } from '@entities/actor/actorMutations';
import { placeSpatialActors } from '@core/movement/movementStrategies';
import { assertEncounterState, migrateEncounterState, parseExportEnvelope } from '@core/persistence/envelope';
import { InMemoryWorkspaceRepository, createEmptyLibraryState } from '@core/persistence/memoryRepository';
import { EXPORT_SCHEMA_VERSION } from '@core/persistence/types';
import { validateEncounter, CLOUD_RECORD_SCHEMA_VERSION } from '@combat-zone/firebase-api';
import { hydrateEncounterRecord } from '@core/persistence/hydratePersistedRecords';
import { serializeEncounterForCloud } from '@core/persistence/cloud/cloudSerialization';
import { store } from '@store/store';
import { loadEncounterState, commitEncounterChange } from '@store/encounterSlice';
import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import { setPersistenceWritable } from '@store/persistenceWriteGuardMiddleware';

function spatial() {
  const state = createActor(createEncounterState({ id: 'spatial', name: 'Spatial' }), { id: 'a', currentZoneId: 'zoneless' });
  state.movementStrategy = 'grid'; state.grid.type = 'hex-flat'; state.grid.origin = { x: 200, y: 200 }; state.grid.rotation = 15;
  return placeSpatialActors(state, { a: { x: 200, y: 200 } });
}
const exportState = (state = spatial()) => ({ kind: 'encounter-export', schemaVersion: EXPORT_SCHEMA_VERSION, exportedAt: 1, encounter: state, library: createEmptyLibraryState() });

describe('spatial persistence', () => {
  afterEach(() => setPersistenceWritable(true));
  it('migrates schema 16 without mutating input or inventing positions', () => {
    const old = { ...spatial(), schemaVersion: 16 } as Record<string, unknown>;
    delete old.grid; delete old.movementStrategy;
    const before = structuredClone(old);
    const migrated = migrateEncounterState(old); assertEncounterState(migrated);
    expect(migrated.movementStrategy).toBe('zone'); expect(migrated.grid).toMatchObject({ type: 'square', cellSize: 64, visible: false });
    expect(old).toEqual(before);
  });
  it('round trips exports, recovery snapshots and cloud payloads losslessly', async () => {
    const envelope = exportState();
    expect(parseExportEnvelope(JSON.parse(JSON.stringify(envelope)))).toEqual(envelope);
    const record = { id: 'spatial', state: envelope.encounter, revision: 0, createdAt: 1, updatedAt: 1, folderId: null };
    expect(hydrateEncounterRecord(record)).toEqual(record);
    const serialized = await serializeEncounterForCloud(record, { ensureUploaded: vi.fn() } as never);
    expect(validateEncounter({ schemaVersion: CLOUD_RECORD_SCHEMA_VERSION, encounterId: 'spatial', folderId: null, assetIds: [], state: JSON.parse(JSON.stringify(serialized.state)) })).toMatchObject({ state: JSON.parse(JSON.stringify(envelope.encounter)) });
  });
  it.each([NaN, Infinity, 0, -1])('rejects invalid grid size %s and preserves the last valid record', async cellSize => {
    const repo = new InMemoryWorkspaceRepository(); const current = spatial(); const record = await repo.createEncounter(current);
    const invalid = { ...current, grid: { ...current.grid, cellSize } };
    await expect(repo.saveEncounter(invalid, { expectedRevision: record.revision })).rejects.toThrow();
    expect((await repo.getEncounter(current.id))?.state).toEqual(current);
  });
  it('rejects invalid coordinates, unsnapped Grid positions and unsupported versions', () => {
    const state = spatial();
    expect(() => assertEncounterState({ ...state, schemaVersion: 999 })).toThrow(/unsupported/);
    const invalid = structuredClone(state); invalid.actors.byId.a.spatialPosition = { x: NaN, y: 200 };
    expect(() => assertEncounterState(invalid)).toThrow(/coordinates/);
    invalid.actors.byId.a.spatialPosition = { x: 201, y: 200 };
    expect(() => assertEncounterState(invalid)).toThrow(/align/);
    expect(() => validateEncounter({ schemaVersion: CLOUD_RECORD_SCHEMA_VERSION, encounterId: state.id, folderId: null, assetIds: [], state: JSON.parse(JSON.stringify({ ...state, grid: { ...state.grid, cellSize: -1 } })) })).toThrow(/spatial/);
  });
  it('handles revision conflicts, fresh history loads, and centrally blocks read-only spatial writes', async () => {
    const state = spatial(); const repo = new InMemoryWorkspaceRepository(); const record = await repo.createEncounter(state);
    await repo.saveEncounter(state, { expectedRevision: record.revision });
    await expect(repo.saveEncounter(state, { expectedRevision: record.revision })).rejects.toThrow(/revision/i);
    store.dispatch(loadEncounterState(state)); expect(store.getState().encounter.past).toEqual([]);
    setPersistenceWritable(false);
    store.dispatch(commitEncounterChange({ action: createEncounterActionRecord('grid.update'), nextEncounter: { ...state, grid: { ...state.grid, opacity: 0.2 } } }));
    expect(store.getState().encounter.present).toEqual(state);
  });
});
