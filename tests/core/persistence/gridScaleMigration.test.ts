import { createEncounterState } from '@core/encounter/createEncounterState';
import { createActor } from '@entities/actor/actorMutations';
import { createZone } from '@entities/zone/zoneMutations';
import { assertEncounterState, migrateEncounterState, parseExportEnvelope } from '@core/persistence/envelope';
import { InMemoryWorkspaceRepository, createEmptyLibraryState } from '@core/persistence/memoryRepository';
import { EXPORT_SCHEMA_VERSION } from '@core/persistence/types';
import { getGridCoverage } from '@core/movement/gridCoverage';
import { resolveGridGeometry } from '@core/movement/gridScale';
import { gridToWorld } from '@core/movement/gridGeometry';
import { validateEncounter, CLOUD_RECORD_SCHEMA_VERSION } from '@combat-zone/firebase-api';
import type { EncounterState } from '@core/encounter/types';

function legacy(type: EncounterState['grid']['type']) {
  let state = createZone(createEncounterState({ id: 'legacy', name: 'Legacy' }), { id: 'z', polygon: [{ x: 100, y: 100 }, { x: 400, y: 100 }, { x: 400, y: 400 }, { x: 100, y: 400 }] });
  state = createActor(state, { id: 'a', currentZoneId: 'z' });
  state.movementStrategy = 'free'; state.grid = { ...state.grid, type, cellSize: 32, origin: { x: 25, y: 40 }, rotation: 17,
    warp: { type: 'bilinear', x: [0, 1, 0, 0.0001], y: [0, 0, 1, 0.0002] } };
  state.actors.byId.a.spatialPosition = { x: 200, y: 220 };
  state.backgroundImage = { name: 'Map', mediaType: 'image/png', width: 1920, height: 1280, source: { kind: 'url', url: 'https://example.com/map.png' } };
  return { ...state, schemaVersion: 20 };
}

it.each(['square', 'hex-flat', 'hex-pointy'] as const)('migrates legacy %s maps without mutating source or losing alignment', async type => {
  const old = legacy(type), original = structuredClone(old);
  const before = gridToWorld(old.grid, { x: 64, y: 96 });
  const next = migrateEncounterState(old) as EncounterState;
  expect(old).toEqual(original); expect(next.schemaVersion).toBe(21);
  expect(getGridCoverage(next)).toMatchObject({ width: 1920, height: 1280 });
  expect(next.grid.cellSize).toBe(32); expect(next.grid.warp).toEqual(old.grid.warp);
  expect(next.actors.byId.a.spatialPosition).toEqual({ x: 400, y: 440 });
  expect(next.zones.byId.z.polygon[0]).toEqual({ x: 200, y: 200 });
  const mapped = gridToWorld(resolveGridGeometry(next.grid), { x: 128, y: 192 });
  expect(mapped.x).toBeCloseTo(before.x * 2); expect(mapped.y).toBeCloseTo(before.y * 2);
  assertEncounterState(next);
  const envelope = { schemaVersion: EXPORT_SCHEMA_VERSION, kind: 'encounter-export', exportedAt: 1, encounter: next, library: createEmptyLibraryState() };
  expect(parseExportEnvelope(JSON.parse(JSON.stringify(envelope)))).toEqual(envelope);
  expect(migrateEncounterState(next)).toEqual(next);
  const repository = new InMemoryWorkspaceRepository(), record = await repository.createEncounter(next);
  expect((await repository.getEncounter(next.id))!.state).toEqual(next);
  await expect(repository.saveEncounter({ ...next, grid: { ...next.grid, cellSize: 0 } }, { expectedRevision: record.revision })).rejects.toThrow();
  expect((await repository.getEncounter(next.id))!.state).toEqual(next);
  expect(() => validateEncounter({ schemaVersion: CLOUD_RECORD_SCHEMA_VERSION, encounterId: next.id, folderId: null, assetIds: [], state: JSON.parse(JSON.stringify(next)) })).not.toThrow();
});

it('rejects invalid legacy geometry before conversion and unsupported newer records', () => {
  const old = legacy('square');
  expect(() => migrateEncounterState({ ...old, grid: { ...old.grid, cellSize: 0 } })).toThrow();
  const envelope = { schemaVersion: EXPORT_SCHEMA_VERSION, kind: 'encounter-export', exportedAt: 1, encounter: { ...old, schemaVersion: 22 }, library: createEmptyLibraryState() };
  expect(() => parseExportEnvelope(envelope)).toThrow(/unsupported/);
});
