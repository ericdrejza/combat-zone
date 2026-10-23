import { withLegacyPanelLayout } from "@tests/core/persistence/legacyPanelLayout";
import { createEncounterState } from '@core/encounter/createEncounterState';
import { createZone } from '@entities/zone/zoneMutations';
import { rotatePoint, updateZoneGeometry } from '@entities/zone/zoneRotation';
import { assertEncounterState, migrateEncounterState, parseExportEnvelope } from '@core/persistence/envelope';
import { InMemoryWorkspaceRepository } from '@core/persistence/memoryRepository';
import { validateEncounter, CLOUD_RECORD_SCHEMA_VERSION } from '@combat-zone/firebase-api';

function stateFor() {
  const state = createZone(createEncounterState({ id: 'rotation', name: 'Rotation' }), { id: 'z', shape: 'rectangle', polygon: [
    { x: 100, y: 100 }, { x: 300, y: 100 }, { x: 300, y: 200 }, { x: 100, y: 200 }
  ] });
  return updateZoneGeometry(state, 'z', state.zones.byId.z.polygon.map(point => rotatePoint(point, -42, { x: 200, y: 150 })), -42);
}

it('migrates schema 26 zones to zero without changing their outline or mutating the input', () => {
  const legacy = { ...withLegacyPanelLayout(stateFor()), schemaVersion: 26 };
  delete legacy.zones.byId.z.rotation;
  const before = structuredClone(legacy);
  const migrated = migrateEncounterState(legacy);
  assertEncounterState(migrated);
  expect(migrated.zones.byId.z.rotation).toBe(0);
  expect(migrated.zones.byId.z.polygon).toEqual(before.zones.byId.z.polygon);
  expect(legacy).toEqual(before);
});

it('round trips orientation through repository, recovery, exports, and cloud validation', async () => {
  const state = stateFor();
  const repository = new InMemoryWorkspaceRepository();
  const saved = await repository.createEncounter(state);
  await repository.saveRecoveryDraft(state);
  expect((await repository.getRecoveryDraft())?.state).toEqual(state);
  const exported = await repository.exportEncounter(saved.id);
  expect(parseExportEnvelope(JSON.parse(JSON.stringify(exported)))).toEqual(exported);
  expect(exported.encounter).toEqual(state);
  expect(validateEncounter({ schemaVersion: CLOUD_RECORD_SCHEMA_VERSION, encounterId: state.id, folderId: null, assetIds: [], state } as never).state).toEqual(state);
});

it.each([NaN, Infinity, -Infinity, 180, -181, '45', null, undefined])('rejects invalid rotation %s before hydration and cloud writes', rotation => {
  const state = stateFor();
  Object.assign(state.zones.byId.z, { rotation });
  expect(() => assertEncounterState(state)).toThrow(/rotation/);
  expect(() => validateEncounter({ schemaVersion: CLOUD_RECORD_SCHEMA_VERSION, encounterId: state.id, folderId: null, assetIds: [], state } as never)).toThrow(/rotation/);
});

it('preserves the last valid record when a malformed rotation fails a save', async () => {
  const state = stateFor();
  const repository = new InMemoryWorkspaceRepository();
  const saved = await repository.createEncounter(state);
  const invalid = structuredClone(state);
  invalid.zones.byId.z.rotation = NaN;
  await expect(repository.saveEncounter(invalid, { expectedRevision: saved.revision })).rejects.toThrow(/rotation/);
  expect((await repository.getEncounter(saved.id))?.state).toEqual(state);
});
