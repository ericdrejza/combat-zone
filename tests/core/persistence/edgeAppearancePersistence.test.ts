import { withLegacyPanelLayout } from "@tests/core/persistence/legacyPanelLayout";
import { CLOUD_RECORD_SCHEMA_VERSION, SUPPORTED_ENCOUNTER_SCHEMA_VERSION, validateEncounter } from '@combat-zone/firebase-api';
import { createEncounterState } from '@core/encounter/createEncounterState';
import { ENCOUNTER_SCHEMA_VERSION } from '@core/encounter/types';
import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import { createEncounterHistoryState } from '@core/history/types';
import { assertEncounterState, migrateEncounterState, parseExportEnvelope } from '@core/persistence/envelope';
import { serializeEncounterForCloud, type CloudAssetRepository } from '@core/persistence/cloud';
import { InMemoryWorkspaceRepository, createEmptyLibraryState } from '@core/persistence/memoryRepository';
import { EXPORT_SCHEMA_VERSION } from '@core/persistence/types';
import { createOrReplaceEdge, DEFAULT_EDGE_PRESET, updateEdges } from '@entities/edge/edgeMutations';
import { createZone } from '@entities/zone/zoneMutations';
import reducer, { commitEncounterChange, undoEncounterChange, redoEncounterChange } from '@store/encounterSlice';

function state() {
  let encounter = createEncounterState({ id: 'edge-appearance', name: 'Edges' });
  for (const [id, x] of [['a', 100], ['b', 500]] as const) {
    encounter = createZone(encounter, { id, shape: 'rectangle', polygon: [
      { x, y: 100 }, { x: x + 200, y: 100 }, { x: x + 200, y: 300 }, { x, y: 300 }
    ] });
  }
  return createOrReplaceEdge(encounter, { ...DEFAULT_EDGE_PRESET, id: 'edge', fromZoneId: 'a', toZoneId: 'b', shape: 'curved' }).nextEncounter;
}
const cloud = (value: unknown) => ({ schemaVersion: CLOUD_RECORD_SCHEMA_VERSION, encounterId: 'edge-appearance',
  folderId: null, assetIds: [], state: JSON.parse(JSON.stringify(value)) });

it('keeps local and cloud schema versions aligned and migrates schema 25 without inventing preferences', () => {
  expect(SUPPORTED_ENCOUNTER_SCHEMA_VERSION).toBe(ENCOUNTER_SCHEMA_VERSION);
  const legacy = { ...withLegacyPanelLayout(state()), schemaVersion: 25 }, before = structuredClone(legacy);
  expect(migrateEncounterState(legacy)).toEqual({ ...legacy, schemaVersion: ENCOUNTER_SCHEMA_VERSION, panelLayout: state().panelLayout });
  expect(legacy).toEqual(before);
  expect(() => validateEncounter(cloud(legacy))).not.toThrow();
});

it.each([null, '#12AbEF'])('round trips Edge color %s and route preferences through local and cloud boundaries', async color => {
  const current = updateEdges(state(), ['edge'], { color, routePreferences: { flipped: true, curvature: 0.65 } });
  const envelope = { schemaVersion: EXPORT_SCHEMA_VERSION, kind: 'encounter-export', exportedAt: 1,
    encounter: current, library: createEmptyLibraryState() };
  expect(parseExportEnvelope(JSON.parse(JSON.stringify(envelope)))).toMatchObject({ encounter: JSON.parse(JSON.stringify(current)) });
  const repository = new InMemoryWorkspaceRepository();
  const record = await repository.createEncounter(current);
  expect((await repository.getEncounter(current.id))!.state).toEqual(current);
  const assets: CloudAssetRepository = { ensureUploaded: vi.fn(), download: vi.fn(), getUsage: vi.fn() };
  const serialized = await serializeEncounterForCloud(record, assets);
  expect(validateEncounter({ ...cloud(serialized.state), assetIds: serialized.assetIds }).state).toMatchObject({ edges: JSON.parse(JSON.stringify(current.edges)) });
  expect(assets.ensureUploaded).not.toHaveBeenCalled();
});

it.each([
  { color: '#123' }, { color: '#zzzzzz' }, { color: 123 },
  { routePreferences: null }, { routePreferences: [] }, { routePreferences: {} },
  { routePreferences: { flipped: 'yes', curvature: 1 } },
  { routePreferences: { flipped: false, curvature: -1 } },
  { routePreferences: { flipped: true, curvature: Infinity } }
])('rejects malformed Edge appearance locally and in the cloud: %j', properties => {
  const invalid = state(); Object.assign(invalid.edges.byId.edge, properties);
  expect(() => assertEncounterState(invalid)).toThrow(/edge/i);
  expect(() => validateEncounter(cloud(invalid))).toThrow(/edge/i);
});

it('preserves the last saved Edge on invalid writes and revision conflicts', async () => {
  const initial = state(), repository = new InMemoryWorkspaceRepository();
  const record = await repository.createEncounter(initial);
  const edited = updateEdges(initial, ['edge'], { color: '#123456', routePreferences: { flipped: true, curvature: 2 } });
  await repository.saveEncounter(edited, { expectedRevision: record.revision });
  await expect(repository.saveEncounter(initial, { expectedRevision: record.revision })).rejects.toThrow(/revision/i);
  const latest = (await repository.getEncounter(initial.id))!;
  const invalid = updateEdges(edited, ['edge'], { routePreferences: { flipped: false, curvature: -1 } });
  await expect(repository.saveEncounter(invalid, { expectedRevision: latest.revision })).rejects.toThrow(/edge/i);
  expect((await repository.getEncounter(initial.id))!.state).toEqual(edited);
});

it('restores route preferences and color together through undo and redo', () => {
  const initial = state();
  const edited = updateEdges(initial, ['edge'], { color: '#123456', routePreferences: { flipped: true, curvature: 0.5 } });
  let history = reducer(createEncounterHistoryState(initial), commitEncounterChange({
    action: createEncounterActionRecord('edge.updateProperties', { edgeIds: ['edge'] }), nextEncounter: edited
  }));
  history = reducer(history, undoEncounterChange());
  expect(history.present.edges).toEqual(initial.edges);
  history = reducer(history, redoEncounterChange());
  expect(history.present.edges).toEqual(edited.edges);
});
