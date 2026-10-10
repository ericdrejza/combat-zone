import { resolveGridGeometry } from '@core/movement/gridScale';
import { completeGridEdges } from '@core/movement/gridEdgeCompletion';
import { getGridCoverage } from '@core/movement/gridCoverage';
import { createEncounterState } from '@core/encounter/createEncounterState';
import { resizeEncounterCanvas } from '@core/encounter/canvasSizeMutations';
import { createActor } from '@entities/actor/actorMutations';
import { placeSpatialActors, resnapSpatialActors } from '@core/movement/movementStrategies';
import { assertEncounterState, migrateEncounterState, parseExportEnvelope } from '@core/persistence/envelope';
import { InMemoryWorkspaceRepository, createEmptyLibraryState } from '@core/persistence/memoryRepository';
import { EXPORT_SCHEMA_VERSION } from '@core/persistence/types';
import { validateEncounter, CLOUD_RECORD_SCHEMA_VERSION } from '@combat-zone/firebase-api';
import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import { prepareValidatedEncounterChange } from '@core/validation/validatedEncounterChange';
import { createEncounterHistoryState } from '@core/history/types';
import reducer, { commitEncounterChange, undoEncounterChange, redoEncounterChange } from '@store/encounterSlice';
import { gridToWorld } from '@core/movement/gridGeometry';

function fixture() {
  const state = createActor(createEncounterState({ id: 'warp', name: 'Warp' }), { id: 'a', currentZoneId: 'zoneless' });
  state.movementStrategy = 'grid'; state.grid.origin = { x: 100, y: 100 };
  return placeSpatialActors(state, { a: { x: 320, y: 320 } });
}
const warp = { type: 'bilinear' as const, x: [0, 1, 0, 0.006] as [number, number, number, number], y: [0, 0, 1, 0.004] as [number, number, number, number] };
describe('warped grid persistence and history', () => {
  it('migrates schema 17 while preserving spatial data', () => {
    const current = fixture(), old = { ...current, schemaVersion: 17 };
    expect(migrateEncounterState(old)).toEqual(completeGridEdges(current)); expect(old.schemaVersion).toBe(17);
  });
  it('round trips warped geometry through export, repository, and cloud contracts', async () => {
    const state = resnapSpatialActors({ ...fixture(), grid: { ...fixture().grid, warp } });
    assertEncounterState(state);
    const envelope = { kind: 'encounter-export', schemaVersion: EXPORT_SCHEMA_VERSION, exportedAt: 1, encounter: state, library: createEmptyLibraryState() };
    expect(parseExportEnvelope(JSON.parse(JSON.stringify(envelope)))).toEqual(envelope);
    const repository = new InMemoryWorkspaceRepository(); await repository.createEncounter(state);
    expect((await repository.getEncounter(state.id))!.state).toEqual(state);
    const cloud = { schemaVersion: CLOUD_RECORD_SCHEMA_VERSION, encounterId: state.id, folderId: null, assetIds: [], state: JSON.parse(JSON.stringify(state)) };
    expect(validateEncounter(cloud).state).toEqual(state);
    cloud.state.grid.warp.x = [1, 2]; expect(() => validateEncounter(cloud)).toThrow(/spatial/);
  });
  it.each(['OFF', 'ADVISORY', 'ASSISTED', 'STRICT'] as const)('commits warp and snapped positions together with exact undo/redo in %s', mode => {
    const state = fixture(); state.validationState.mode = mode;
    const next = resnapSpatialActors({ ...state, grid: { ...state.grid, warp } });
    const prepared = prepareValidatedEncounterChange({ currentEncounter: state, nextEncounter: next, action: createEncounterActionRecord('grid.calibrate') });
    expect(prepared.blocked).toBe(false);
    let history = reducer(createEncounterHistoryState(state), commitEncounterChange({ action: prepared.action, nextEncounter: prepared.nextEncounter }));
    expect(history.present.grid.warp).toEqual(warp);
    history = reducer(history, undoEncounterChange()); expect(history.present).toEqual(state);
    history = reducer(history, redoEncounterChange()); expect(history.present).toEqual(next);
    const folded = { ...next, grid: { ...next.grid, warp: { ...warp, x: [0, -1, 0, 0] as typeof warp.x } } };
    expect(prepareValidatedEncounterChange({ currentEncounter: next, nextEncounter: folded, action: createEncounterActionRecord('grid.calibrate') }).blocked).toBe(true);
  });
  it('keeps warped geometry fixed when resizing the background and preserves valid data after rejected saves', async () => {
    const state = resnapSpatialActors({ ...fixture(), grid: { ...fixture().grid, warp } });
    const point = gridToWorld(resolveGridGeometry(state.grid), { x: 128, y: 192 });
    const resized = resizeEncounterCanvas(state, { canvasSize: { width: 480, height: 320 }, zoneScale: 0.5 });
    const scaled = gridToWorld(resolveGridGeometry(resized.grid), { x: 128, y: 192 });
    const frame = getGridCoverage(resized);
    expect(scaled.x - frame.x).toBeCloseTo(point.x); expect(scaled.y - frame.y).toBeCloseTo(point.y); assertEncounterState(resized);
    const repository = new InMemoryWorkspaceRepository(), record = await repository.createEncounter(state);
    await expect(repository.saveEncounter({ ...state, grid: { ...state.grid, warp: { ...warp, x: [0, 0, 0, 0] } } }, { expectedRevision: record.revision })).rejects.toThrow();
    expect((await repository.getEncounter(state.id))!.state).toEqual(state);
  });
});
