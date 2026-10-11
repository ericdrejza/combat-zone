import { createEncounterState } from '@core/encounter/createEncounterState';
import { createActor, updateActorProperties } from '@entities/actor/actorMutations';
import { assertEncounterState, migrateEncounterState, parseExportEnvelope } from '@core/persistence/envelope';
import { InMemoryWorkspaceRepository, createEmptyLibraryState } from '@core/persistence/memoryRepository';
import { EXPORT_SCHEMA_VERSION } from '@core/persistence/types';
import { CLOUD_RECORD_SCHEMA_VERSION, validateEncounter } from '@combat-zone/firebase-api';
import { prepareValidatedEncounterChange } from '@core/validation/validatedEncounterChange';
import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';

const state = () => createActor(createEncounterState({ id: 'flip', name: 'Flip' }), {
  currentZoneId: 'zoneless', id: 'a', image: { name: 'Token', mediaType: 'image/png', source: { kind: 'url', url: 'https://example.com/token.png' } }
});
const cloud = (value: unknown) => ({ schemaVersion: CLOUD_RECORD_SCHEMA_VERSION,
  encounterId: 'flip', folderId: null, assetIds: [], state: JSON.parse(JSON.stringify(value)) });

it('round trips image flipping through exports, repository saves, and cloud validation', async () => {
  const original = state(), flipped = updateActorProperties(original, 'a', { imageFlippedHorizontal: true });
  const envelope = { schemaVersion: EXPORT_SCHEMA_VERSION, kind: 'encounter-export', exportedAt: 1,
    encounter: flipped, library: createEmptyLibraryState() };
  expect(parseExportEnvelope(JSON.parse(JSON.stringify(envelope)))).toMatchObject({ encounter: JSON.parse(JSON.stringify(flipped)) });
  const repo = new InMemoryWorkspaceRepository(); const record = await repo.createEncounter(original);
  await repo.saveEncounter(flipped, { expectedRevision: record.revision });
  expect((await repo.getEncounter('flip'))!.state).toEqual(flipped);
  expect(() => validateEncounter(cloud(flipped))).not.toThrow();
  expect(migrateEncounterState(original)).toEqual(original);
  expect(original.actors.byId.a.imageFlippedHorizontal ?? false).toBe(false);
});

it.each([null, 1, 'true'])('rejects invalid image flip flag %s at local and cloud boundaries', flag => {
  const invalid = state(); Object.assign(invalid.actors.byId.a, { imageFlippedHorizontal: flag });
  expect(() => assertEncounterState(invalid)).toThrow(/imageFlippedHorizontal/);
  expect(() => validateEncounter(cloud(invalid))).toThrow(/imageFlippedHorizontal/);
});

it.each(['ADVISORY', 'STRICT'] as const)('respects %s validation when flipping an actor with a missing Zone', mode => {
  const current = state(); current.validationState.mode = mode;
  current.actors.byId.a.currentZoneId = 'missing-zone';
  const prepared = prepareValidatedEncounterChange({ currentEncounter: current,
    nextEncounter: updateActorProperties(current, 'a', { imageFlippedHorizontal: true }),
    action: createEncounterActionRecord('actor.updateProperties', { actorId: 'a' }) });
  expect(prepared.blocked).toBe(mode === 'STRICT');
  expect(prepared.validationResult.messages).toContainEqual(expect.objectContaining({ code: 'zoneIntegrity.actorZoneMissing' }));
});
