import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import { beginEncounterOperation } from '@core/history/encounterOperations';
import { createActor } from '@entities/actor/actorMutations';
import { selectEntity, setActiveTool } from '@interaction/interactionState';
import { commitEncounterChange, loadEncounterState, redoEncounterChange, undoEncounterChange } from '@store/encounterSlice';
import { setPersistenceWritable } from '@store/persistenceWriteGuardMiddleware';
import { store } from '@store/store';
import { resetAppStore } from '@tests/ui/renderApp';

beforeEach(resetAppStore);
afterEach(() => setPersistenceWritable(true));
function rename(name: string) {
  store.dispatch(commitEncounterChange({ action: createEncounterActionRecord('encounter.rename'), nextEncounter: { ...store.getState().encounter.present, name } }));
}
it('blocks direct undo and redo during operations and in read-only tabs', () => {
  rename('Changed');
  const before = store.getState();
  const release = beginEncounterOperation();
  try {
    store.dispatch(undoEncounterChange());
    expect(store.getState()).toBe(before);
  } finally { release(); }
  store.dispatch(undoEncounterChange());
  const undone = store.getState();
  const releaseRedo = beginEncounterOperation();
  try { store.dispatch(redoEncounterChange()); expect(store.getState()).toBe(undone); }
  finally { releaseRedo(); }
  setPersistenceWritable(false);
  store.dispatch(redoEncounterChange());
  expect(store.getState()).toBe(undone);
  setPersistenceWritable(true);
  store.dispatch(redoEncounterChange());
  const redone = store.getState();
  setPersistenceWritable(false);
  store.dispatch(undoEncounterChange());
  expect(store.getState()).toBe(redone);
});
it('retains valid selections, prunes invalid ids, and does not reselect on redo', () => {
  const base = createActor(store.getState().encounter.present, { id: 'existing', name: 'Existing', currentZoneId: 'zoneless' });
  store.dispatch(loadEncounterState(base));
  const next = createActor(base, { id: 'new', name: 'New', currentZoneId: 'zoneless' });
  store.dispatch(commitEncounterChange({ action: createEncounterActionRecord('actor.create'), nextEncounter: next }));
  store.dispatch(setActiveTool('select'));
  store.dispatch(selectEntity({ entityType: 'actor', ids: ['existing', 'new'] }));
  store.dispatch(undoEncounterChange());
  expect(store.getState().interaction.selection.selectedIds).toEqual(['existing']);
  store.dispatch(redoEncounterChange());
  expect(store.getState().interaction.selection.selectedIds).toEqual(['existing']);
});
it('ignores ineffective commits without destroying redo or adding logs', () => {
  rename('Changed'); store.dispatch(undoEncounterChange());
  const before = store.getState();
  store.dispatch(commitEncounterChange({ action: createEncounterActionRecord('test.noop'), nextEncounter: before.encounter.present }));
  expect(store.getState()).toBe(before);
  store.dispatch(redoEncounterChange());
  expect(store.getState().encounter.present.name).toBe('Changed');
});
