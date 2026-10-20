import { act, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { createEncounterState } from '@core/encounter/createEncounterState';
import { InMemoryWorkspaceRepository } from '@core/persistence/memoryRepository';
import { undoEncounterChange, redoEncounterChange } from '@store/encounterSlice';
import { store } from '@store/store';
import { resetAppStore } from '@tests/ui/renderApp';
import { PersistenceProvider, usePersistence } from '@ui/persistence/PersistenceProvider';
import { setRulerDraft, lockRulerDraft, editLockedRuler, updateRulerPoint } from '@interaction/interactionState';
import { selectLockedRulers } from '@interaction/rulerState';

function Probe() {
  const persistence = usePersistence();
  return <><span>{persistence.initialized ? 'Ready' : 'Loading'}</span><span>{persistence.saveStatus}</span>
    <button onClick={() => void persistence.save()}>Save</button><button onClick={() => void persistence.loadEncounter('other')}>Load other</button></>;
}
const mount = (repository: InMemoryWorkspaceRepository) => {
  resetAppStore(); return render(<Provider store={store}><PersistenceProvider repository={repository}><Probe /></PersistenceProvider></Provider>);
};
async function fixture() {
  const repository = new InMemoryWorkspaceRepository(), state = createEncounterState({ id: 'rulers', name: 'Rulers' });
  await repository.createEncounter(state, 'encounters-root'); await repository.createEncounter(createEncounterState({ id: 'other', name: 'Other' }), 'encounters-root');
  await repository.saveManifest({ ...(await repository.getManifest()), activeEncounterId: state.id });
  return { repository, state };
}
function draw() {
  store.dispatch(setRulerDraft({ points: [{ x: 100, y: 100 }, { x: 200, y: 100 }], complete: true }));
  store.dispatch(lockRulerDraft());
}
it('autosaves locked rulers, undo/redo and edits, flushes navigation, and restores rulers with fresh history after reload', async () => {
  const { repository, state } = await fixture(); const view = mount(repository); await screen.findByText('Ready');
  act(draw); const artifact = selectLockedRulers(store.getState())[0], saved = store.getState().encounter.present;
  await waitFor(async () => expect((await repository.getEncounter(state.id))?.state.rulers).toEqual(saved.rulers), { timeout: 1800 });
  act(() => store.dispatch(undoEncounterChange()));
  await waitFor(async () => expect((await repository.getEncounter(state.id))?.state.rulers.allIds).toEqual([]), { timeout: 1800 });
  act(() => store.dispatch(redoEncounterChange()));
  await act(async () => screen.getByRole('button', { name: 'Save' }).click());
  expect((await repository.getEncounter(state.id))?.state.rulers).toEqual(saved.rulers);
  act(() => { store.dispatch(editLockedRuler(artifact.id)); store.dispatch(updateRulerPoint({ id: artifact.id, index: 1, point: { x: 320, y: 200 } })); });
  await act(async () => screen.getByRole('button', { name: 'Save' }).click());
  expect((await repository.getEncounter(state.id))?.state.rulers).toEqual(saved.rulers);
  act(() => store.dispatch(lockRulerDraft())); const edited = store.getState().encounter.present;
  await act(async () => screen.getByRole('button', { name: 'Load other' }).click());
  expect((await repository.getEncounter(state.id))?.state.rulers).toEqual(edited.rulers);
  view.unmount(); await repository.saveManifest({ ...(await repository.getManifest()), activeEncounterId: state.id });
  mount(repository); await screen.findByText('Ready');
  expect(store.getState().encounter.present.rulers).toEqual(edited.rulers); expect(store.getState().encounter.past).toEqual([]);
  expect(store.getState().interaction.editingRuler).toBeNull(); expect(store.getState().interaction.rulerDraft).toBeNull();
});
it('recovers locked rulers in an unfiled draft, excluding unfinished measurements', async () => {
  const { repository, state } = await fixture();
  await repository.saveManifest({ ...(await repository.getManifest()), activeEncounterId: null }); await repository.saveRecoveryDraft(state);
  const view = mount(repository); await screen.findByText('Ready'); act(draw);
  const saved = store.getState().encounter.present;
  act(() => store.dispatch(setRulerDraft({ points: [{ x: 10, y: 10 }], complete: false })));
  await waitFor(async () => expect((await repository.getRecoveryDraft())?.state.rulers).toEqual(saved.rulers), { timeout: 1800 });
  view.unmount(); mount(repository); await screen.findByText('Ready');
  expect(store.getState().encounter.present.rulers).toEqual(saved.rulers); expect(store.getState().interaction.rulerDraft).toBeNull();
});
it('keeps accepted rulers in memory and last valid durable data after a write failure', async () => {
  const { repository, state } = await fixture(); mount(repository); await screen.findByText('Ready');
  const write = vi.spyOn(repository, 'saveEncounter').mockRejectedValue(new Error('Disk full'));
  act(draw); await screen.findByText('error', {}, { timeout: 1800 });
  expect(selectLockedRulers(store.getState())).toHaveLength(1); expect((await repository.getEncounter(state.id))?.state.rulers.allIds).toEqual([]);
  write.mockRestore();
});
