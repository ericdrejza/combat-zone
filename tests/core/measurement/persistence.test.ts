import { ENCOUNTER_SCHEMA_VERSION } from '@core/encounter/types';
import { createEncounterState } from '@core/encounter/createEncounterState';
import { createActor } from '@entities/actor/actorMutations';
import { assertEncounterState, migrateEncounterState, parseExportEnvelope } from '@core/persistence/envelope';
import { InMemoryWorkspaceRepository } from '@core/persistence/memoryRepository';
import { validateEncounter, CLOUD_RECORD_SCHEMA_VERSION } from '@combat-zone/firebase-api';
import { updateGridConfiguration, applyGridAlignment } from '@core/movement/updateGridConfiguration';
import { calibrateGrid } from '@core/movement/gridCalibration';
import { resizeEncounterCanvas } from '@core/encounter/canvasSizeMutations';

function fixture() {
  const state = createActor(createEncounterState({ id: 'measurement', name: 'Measurements' }), { id: 'a', currentZoneId: 'zoneless' });
  state.grid = { ...state.grid, lineStyle: 'crosshair', distancePerCell: 10, distanceUnit: 'meters' };
  state.actors.byId.a.movementLimit = 30;
  state.initiativeTracker.movement = { a: { distance: 12, diagonals: 1 } };
  return state;
}
const cloud = (state: unknown) => validateEncounter({ schemaVersion: CLOUD_RECORD_SCHEMA_VERSION, encounterId: 'measurement', folderId: null, assetIds: [], state: JSON.parse(JSON.stringify(state)) } as never);

describe('measurement persistence', () => {
  it('migrates schema 27 without mutating its geometry or source', () => {
    const legacy = { ...fixture(), schemaVersion: 27 };
    delete legacy.grid.lineStyle; delete legacy.grid.distancePerCell; delete legacy.grid.distanceUnit; delete legacy.initiativeTracker.movement;
    const copy = structuredClone(legacy), migrated = migrateEncounterState(legacy);
    assertEncounterState(migrated);
    expect(migrated.schemaVersion).toBe(ENCOUNTER_SCHEMA_VERSION);
    expect(migrated.grid).toMatchObject({ lineStyle: 'solid', distancePerCell: 5, distanceUnit: 'feet' });
    expect(migrated.initiativeTracker.movement ?? {}).toEqual({}); expect(legacy).toEqual(copy);
  });
  it('round trips repository, exports, recovery and cloud without losing totals or styles', async () => {
    const state = fixture(), repo = new InMemoryWorkspaceRepository();
    await repo.createEncounter(state); await repo.saveRecoveryDraft(state);
    expect((await repo.getRecoveryDraft())?.state).toEqual(state);
    const exported = await repo.exportEncounter(state.id);
    expect(parseExportEnvelope(JSON.parse(JSON.stringify(exported)))).toEqual(exported);
    expect(cloud(state).state).toEqual(JSON.parse(JSON.stringify(state)));
  });
  it.each([
    { lineStyle: 'unknown' }, { distancePerCell: 0 }, { distancePerCell: 1.5 }, { distancePerCell: Infinity }, { distanceUnit: '' }
  ])('rejects invalid measurement settings %s locally and in cloud, preserving valid records', async patch => {
    const state = fixture(), repo = new InMemoryWorkspaceRepository(), record = await repo.createEncounter(state);
    const invalid = { ...state, grid: { ...state.grid, ...patch } };
    expect(() => assertEncounterState(invalid)).toThrow(); expect(() => cloud(invalid)).toThrow();
    await expect(repo.saveEncounter(invalid as typeof state, { expectedRevision: record.revision })).rejects.toThrow();
    expect((await repo.getEncounter(state.id))?.state).toEqual(state);
  });
  it('rejects dangling totals, negative limits, and unsupported newer versions', () => {
    const state = fixture(); state.initiativeTracker.movement = { missing: { distance: 1, diagonals: 0 } };
    expect(() => assertEncounterState(state)).toThrow(); expect(() => cloud(state)).toThrow();
    state.initiativeTracker.movement = {}; state.actors.byId.a.movementLimit = -1;
    expect(() => assertEncounterState(state)).toThrow(); expect(() => cloud(state)).toThrow();
    expect(() => assertEncounterState(migrateEncounterState({ ...fixture(), schemaVersion: 999 }))).toThrow();
  });
  it('preserves styles and measurement scale through type, alignment and map resizing', () => {
    const state = fixture(), expected = { lineStyle: 'crosshair', distancePerCell: 10, distanceUnit: 'meters' };
    expect(updateGridConfiguration(state, { ...state.grid, type: 'hex-flat' }).grid).toMatchObject(expected);
    const aligned = calibrateGrid(state.grid, [{ x: 64, y: 64 }, { x: 128, y: 64 }, { x: 128, y: 128 }, { x: 64, y: 128 }]);
    expect(aligned).not.toBeNull(); expect(applyGridAlignment(state, aligned!).grid).toMatchObject(expected);
    expect(resizeEncounterCanvas(state, { canvasSize: { width: 800, height: 600 }, zoneScale: 1 }).grid).toMatchObject(expected);
  });
});
