import { createEncounterState } from '@core/encounter/createEncounterState';
import { completeGridEdges } from '@core/movement/gridEdgeCompletion';
import { getBackgroundFrame } from '@core/encounter/backgroundFrame';
import { InMemoryWorkspaceRepository, createEmptyLibraryState } from '@core/persistence/memoryRepository';
import { assertEncounterState, EXPORT_SCHEMA_VERSION, parseExportEnvelope } from '@core/persistence';
import { validateEncounter, CLOUD_RECORD_SCHEMA_VERSION } from '@combat-zone/firebase-api';
import type { EncounterState } from '@core/encounter/types';
const validateCloud = (state: EncounterState) => validateEncounter({ schemaVersion: CLOUD_RECORD_SCHEMA_VERSION, encounterId: state.id, folderId: null, assetIds: [], state: JSON.parse(JSON.stringify(state)) });

function state() {
  const initial = createEncounterState({ id: 'edge-save', name: 'Edges' });
  initial.grid.origin = { x: -2, y: -2 }; initial.canvasSize = { width: 188, height: 188 };
  initial.backgroundImage = { source: { kind: 'url', url: 'https://example.com/map.png' }, width: 188, height: 188, mediaType: 'image/png', name: 'Map' };
  return completeGridEdges(initial);
}
describe('completed edge persistence and cloud contract', () => {
  it('round trips placement through repository and export, retaining last good data on invalid and conflicting saves', async () => {
    const saved = state(), repository = new InMemoryWorkspaceRepository();
    const record = await repository.createEncounter(saved);
    expect((await repository.getEncounter(saved.id))!.state).toEqual(saved);
    const envelope = { kind: 'encounter-export', schemaVersion: EXPORT_SCHEMA_VERSION, exportedAt: 1, encounter: saved, library: createEmptyLibraryState() };
    expect(parseExportEnvelope(JSON.parse(JSON.stringify(envelope)))).toEqual(envelope);
    const invalid = structuredClone(saved); invalid.backgroundImage!.frame!.x = -1;
    await expect(repository.saveEncounter(invalid, { expectedRevision: record.revision })).rejects.toThrow();
    await expect(repository.saveEncounter(saved, { expectedRevision: record.revision + 1 })).rejects.toThrow();
    expect((await repository.getEncounter(saved.id))!.state).toEqual(saved);
    expect(() => validateCloud(saved)).not.toThrow();
  });
  it.each([null, { x: -1, y: 0, width: 100, height: 100 }, { x: 0, y: 0, width: 1000, height: 100 }, { x: 0, y: 0, width: 0, height: 100 }, { x: 0, y: NaN, width: 100, height: 100 }])('rejects invalid placement %j before local or cloud writes', frame => {
    const invalid = state(); invalid.backgroundImage!.frame = frame as never;
    expect(() => assertEncounterState(invalid)).toThrow(/frame/);
    expect(() => validateCloud(invalid)).toThrow();
  });
  it('round trips image-less original coverage and rejects duplicate or invalid coverage', async () => {
    const initial = createEncounterState({ id: 'no-image', name: 'No image' });
    initial.grid.origin = { x: -2, y: -2 };
    const saved = completeGridEdges(initial);
    const repository = new InMemoryWorkspaceRepository();
    await repository.createEncounter(saved);
    expect((await repository.getEncounter(saved.id))!.state).toEqual(saved);
    expect(() => validateCloud(saved)).not.toThrow();
    const invalid = { ...saved, gridCoverage: { ...saved.gridCoverage!, x: -1 } };
    expect(() => assertEncounterState(invalid)).toThrow(/coverage/i);
    expect(() => validateCloud(invalid)).toThrow();
    const duplicate = { ...state(), gridCoverage: saved.gridCoverage };
    expect(() => assertEncounterState(duplicate)).toThrow(/coverage/i);
  });
  it('migrates schema 18 without changing its full-canvas background and rejects newer documents', () => {
    const initial = createEncounterState({ id: 'old-grid', name: 'Old' });
    const envelope = { kind: 'encounter-export', schemaVersion: EXPORT_SCHEMA_VERSION, exportedAt: 1, encounter: { ...initial, schemaVersion: 18 }, library: createEmptyLibraryState() };
    const parsed = parseExportEnvelope(envelope);
    expect(parsed.kind).toBe('encounter-export');
    if (parsed.kind === 'encounter-export') {
      expect(parsed.encounter.schemaVersion).toBe(21);
      expect(getBackgroundFrame(parsed.encounter.backgroundImage, parsed.encounter.canvasSize)).toEqual({ ...initial.canvasSize, x: 0, y: 0 });
    }
    expect(() => parseExportEnvelope({ ...envelope, encounter: { ...initial, schemaVersion: 22 } })).toThrow(/unsupported/);
  });
});
