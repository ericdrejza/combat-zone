import { withLegacyPanelLayout } from "@tests/core/persistence/legacyPanelLayout";
import { createEncounterState } from '@core/encounter/createEncounterState';
import { createActor, updateActorProperties } from '@entities/actor/actorMutations';
import { assertEncounterState, migrateEncounterState, parseExportEnvelope } from '@core/persistence/envelope';
import { InMemoryWorkspaceRepository, createEmptyLibraryState } from '@core/persistence/memoryRepository';
import { EXPORT_SCHEMA_VERSION } from '@core/persistence/types';
import { CLOUD_RECORD_SCHEMA_VERSION, validateEncounter } from '@combat-zone/firebase-api';
import { prepareValidatedEncounterChange } from '@core/validation/validatedEncounterChange';
import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import { createEncounterHistoryState } from '@core/history/types';
import reducer, { commitEncounterChange, undoEncounterChange, redoEncounterChange } from '@store/encounterSlice';

const cloud = (state: unknown) => ({ schemaVersion: CLOUD_RECORD_SCHEMA_VERSION, encounterId: 'transparent', folderId: null, assetIds: [], state: JSON.parse(JSON.stringify(state)) });

it('round trips Transparent through exports, repository, and cloud while rejecting older schemas claiming it', async () => {
  const state = createActor(createEncounterState({ id: 'transparent', name: 'Transparent' }), { currentZoneId: 'zoneless', id: 'a', shape: 'transparent' });
  assertEncounterState(state);
  const envelope = { schemaVersion: EXPORT_SCHEMA_VERSION, kind: 'encounter-export', exportedAt: 1, encounter: state, library: createEmptyLibraryState() };
  expect(parseExportEnvelope(JSON.parse(JSON.stringify(envelope)))).toEqual(envelope);
  const repo = new InMemoryWorkspaceRepository(); await repo.createEncounter(state);
  expect((await repo.getEncounter(state.id))!.state.actors.byId.a.shape).toBe('transparent');
  expect(() => validateEncounter(cloud(state))).not.toThrow();
  expect(() => migrateEncounterState({ ...withLegacyPanelLayout(state), schemaVersion: 24 })).toThrow(/Transparent/);
  expect(() => validateEncounter(cloud({ ...withLegacyPanelLayout(state), schemaVersion: 24 }))).toThrow(/spatial/);
});

it('migrates schema 24 without changing actor shapes or grid geometry', () => {
  const current = createActor(createEncounterState({ id: 'transparent', name: 'Transparent' }), { currentZoneId: 'zoneless', id: 'a', shape: 'rectangle' });
  current.grid = { ...current.grid, type: 'isometric', isometricAngle: 30 };
  expect(migrateEncounterState({ ...withLegacyPanelLayout(current), schemaVersion: 24 })).toEqual(current);
});

it.each(['ADVISORY', 'STRICT'] as const)('validates and restores a Transparent shape edit in %s', mode => {
  const state = createActor(createEncounterState({ id: 'transparent', name: 'Transparent' }), { currentZoneId: 'zoneless', id: 'a' });
  state.validationState.mode = mode;
  const action = createEncounterActionRecord('actor.updateProperties', { actorIds: ['a'] });
  const next = updateActorProperties(state, 'a', { shape: 'transparent' });
  const prepared = prepareValidatedEncounterChange({ currentEncounter: state, nextEncounter: next, action });
  expect(prepared.blocked).toBe(false);
  let history = reducer(createEncounterHistoryState(state), commitEncounterChange({ action, nextEncounter: prepared.nextEncounter }));
  expect(history.present.actors.byId.a.shape).toBe('transparent');
  history = reducer(history, undoEncounterChange()); expect(history.present).toEqual(state);
  history = reducer(history, redoEncounterChange()); expect(history.present).toEqual(prepared.nextEncounter);
});
