import { act, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { createEncounterState } from '@core/encounter/createEncounterState';
import { createActor } from '@entities/actor/actorMutations';
import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import { placeSpatialActors } from '@core/movement/movementStrategies';
import { InMemoryWorkspaceRepository } from '@core/persistence/memoryRepository';
import { commitEncounterChange, undoEncounterChange, redoEncounterChange } from '@store/encounterSlice';
import { store } from '@store/store';
import { resetAppStore } from '@tests/ui/renderApp';
import { PersistenceProvider, usePersistence } from '@ui/persistence/PersistenceProvider';

function Probe() {
  const persistence = usePersistence();
  return <><span>{persistence.initialized ? 'Ready' : 'Loading'}</span>
    <button onClick={() => void persistence.save()}>Save</button>
    <button onClick={() => void persistence.loadEncounter('other')}>Load other</button></>;
}
const mount = (repository: InMemoryWorkspaceRepository) => {
  resetAppStore(); return render(<Provider store={store}><PersistenceProvider repository={repository}><Probe /></PersistenceProvider></Provider>);
};
async function fixture() {
  const repository = new InMemoryWorkspaceRepository();
  let state = createActor(createEncounterState({ id: 'spatial-save', name: 'Spatial' }), { id: 'a', currentZoneId: 'zoneless' });
  state.movementStrategy = 'grid'; state = placeSpatialActors(state, { a: { x: 160, y: 160 } });
  await repository.createEncounter(state, 'encounters-root');
  await repository.createEncounter(createEncounterState({ id: 'other', name: 'Other' }), 'encounters-root');
  await repository.saveManifest({ ...(await repository.getManifest()), activeEncounterId: state.id });
  return { repository, state };
}
it('autosaves spatial facts and history, explicitly saves, flushes navigation, and restores fresh history', async () => {
  const { repository, state } = await fixture(); const view = mount(repository); await screen.findByText('Ready');
  const moved = placeSpatialActors(state, { a: { x: 224, y: 160 } });
  act(() => store.dispatch(commitEncounterChange({ action: createEncounterActionRecord('actor.moveSpatial'), nextEncounter: moved })));
  await waitFor(async () => expect((await repository.getEncounter(state.id))?.state).toEqual(moved), { timeout: 1500 });
  act(() => store.dispatch(undoEncounterChange()));
  await waitFor(async () => expect((await repository.getEncounter(state.id))?.state).toEqual(state), { timeout: 1500 });
  act(() => store.dispatch(redoEncounterChange()));
  await act(async () => screen.getByRole('button', { name: 'Save' }).click());
  expect((await repository.getEncounter(state.id))?.state).toEqual(moved);
  const changed = { ...moved, movementStrategy: 'free' as const, grid: { ...moved.grid, opacity: 0.25 } };
  act(() => store.dispatch(commitEncounterChange({ action: createEncounterActionRecord('movement.changeStrategy'), nextEncounter: changed })));
  await act(async () => screen.getByRole('button', { name: 'Load other' }).click());
  expect((await repository.getEncounter(state.id))?.state).toEqual(changed);
  expect(store.getState().encounter.past).toEqual([]);
  view.unmount(); await repository.saveManifest({ ...(await repository.getManifest()), activeEncounterId: state.id });
  mount(repository); await screen.findByText('Ready');
  expect(store.getState().encounter.present).toEqual(changed); expect(store.getState().encounter.past).toEqual([]);
});
it('recovers spatial coordinates and grid settings from a draft', async () => {
  const { repository, state } = await fixture();
  await repository.saveManifest({ ...(await repository.getManifest()), activeEncounterId: null });
  await repository.saveRecoveryDraft(state); mount(repository); await screen.findByText('Ready');
  expect(store.getState().encounter.present).toEqual(state); expect(store.getState().encounter.past).toEqual([]);
});
