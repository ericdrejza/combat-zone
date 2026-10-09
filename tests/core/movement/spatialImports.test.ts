import { createEncounterState } from '@core/encounter/createEncounterState';
import { createActor } from '@entities/actor/actorMutations';
import { InMemoryWorkspaceRepository } from '@core/persistence/memoryRepository';
import { placeSpatialActors } from '@core/movement/movementStrategies';

async function fixture() {
  const source = new InMemoryWorkspaceRepository();
  const state = createActor(createEncounterState({ id: 'same', name: 'Imported' }), { id: 'actor', currentZoneId: 'zoneless' });
  state.movementStrategy = 'free'; state.grid.rotation = 27;
  await source.createEncounter(placeSpatialActors(state, { actor: { x: 121, y: 141 } }));
  return source.exportWorkspace();
}
it('preserves spatial data through encounter-ID remapping in workspace merges', async () => {
  const repository = new InMemoryWorkspaceRepository();
  await repository.createEncounter(createEncounterState({ id: 'same', name: 'Current' }));
  await repository.importWorkspace(await fixture(), 'merge');
  const records = await repository.listEncounters();
  expect(records).toHaveLength(2);
  const imported = records.find(record => record.state.name === 'Imported')!;
  expect(imported.id).not.toBe('same');
  expect(imported.state).toMatchObject({ id: imported.id, movementStrategy: 'free', grid: { rotation: 27 }, actors: { byId: { actor: { spatialPosition: { x: 121, y: 141 } } } } });
});
it('rejects an invalid multi-record import atomically and retains a recoverable overwrite backup', async () => {
  const repository = new InMemoryWorkspaceRepository();
  const original = createEncounterState({ id: 'current', name: 'Current' });
  await repository.createEncounter(original);
  const envelope = await fixture();
  const invalid = structuredClone(envelope);
  invalid.workspace.encounters.push({ ...invalid.workspace.encounters[0], id: 'invalid', state: { ...invalid.workspace.encounters[0].state, id: 'invalid', grid: { ...invalid.workspace.encounters[0].state.grid, cellSize: -1 } } });
  await expect(repository.importWorkspace(invalid, 'merge')).rejects.toThrow();
  expect((await repository.listEncounters()).map(record => record.state)).toEqual([original]);
  const backup = await repository.exportWorkspace(); await repository.saveBackup(backup);
  await repository.importWorkspace(envelope, 'overwrite');
  expect(await repository.getLatestBackup()).toEqual(backup);
  expect((await repository.getEncounter('same'))?.state.actors.byId.actor.spatialPosition).toEqual({ x: 121, y: 141 });
});
