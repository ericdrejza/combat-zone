import type { EncounterState } from '@core/encounter/types';
import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import { createActor } from '@entities/actor/actorMutations';
import { createZone, deleteZone } from '@entities/zone/zoneMutations';
import { selectEntity, setActiveTool } from '@interaction/interactionState';
import { commitEncounterChange, loadEncounterState, redoEncounterChange, undoEncounterChange } from '@store/encounterSlice';
import { store } from '@store/store';
import { resetAppStore } from '@tests/ui/renderApp';
import { CANVAS_PREFERENCES_KEY, DEFAULT_CANVAS_PREFERENCES, saveCanvasPreferences } from '@ui/canvas_preferences/canvasPreferenceStorage';
import { LOCAL_PREFERENCES_RESET_EVENT } from '@ui/motion_preferences/MotionPreferenceProvider';

beforeEach(() => {
  resetAppStore();
  localStorage.removeItem(CANVAS_PREFERENCES_KEY);
  window.dispatchEvent(new Event(LOCAL_PREFERENCES_RESET_EVENT));
});
afterEach(() => {
  localStorage.removeItem(CANVAS_PREFERENCES_KEY);
  window.dispatchEvent(new Event(LOCAL_PREFERENCES_RESET_EVENT));
});
function enabled(selectOnUndoRedo = true) {
  saveCanvasPreferences({ ...DEFAULT_CANVAS_PREFERENCES, selectOnUndoRedo });
}
function commit(type: string, nextEncounter: EncounterState) {
  store.dispatch(commitEncounterChange({ action: createEncounterActionRecord(type), nextEncounter }));
}
function actors() {
  let state = store.getState().encounter.present;
  for (const id of ['first', 'second', 'unchanged']) state = createActor(state, { id, name: id, currentZoneId: 'zoneless' });
  store.dispatch(loadEncounterState(state));
  store.dispatch(setActiveTool('select'));
  store.dispatch(selectEntity({ entityType: 'actor', ids: ['unchanged'] }));
  return state;
}

it('selects all changed Actors on undo and redo, excluding unchanged Actors', () => {
  enabled();
  const base = actors();
  const byId = { ...base.actors.byId };
  for (const id of ['first', 'second']) byId[id] = { ...byId[id], name: `${id} updated` };
  commit('actor.updateProperties', { ...base, actors: { ...base.actors, byId } });
  store.dispatch(undoEncounterChange());
  expect(store.getState().interaction.selection.selectedIds).toEqual(['first', 'second']);
  store.dispatch(selectEntity({ entityType: 'actor', ids: ['unchanged'] }));
  store.dispatch(redoEncounterChange());
  expect(store.getState().interaction.selection.selectedIds).toEqual(['first', 'second']);
});

it('preserves valid selection when the preference is disabled', () => {
  enabled(false);
  const base = actors();
  commit('actor.updateProperties', { ...base, actors: { ...base.actors, byId: {
    ...base.actors.byId, first: { ...base.actors.byId.first, name: 'Updated' }
  } } });
  store.dispatch(undoEncounterChange());
  store.dispatch(redoEncounterChange());
  expect(store.getState().interaction.selection.selectedIds).toEqual(['unchanged']);
});

it('switches to Select when needed and selects a recreated Actor on redo', () => {
  enabled();
  const base = actors();
  commit('actor.create', createActor(base, { id: 'new', name: 'New', currentZoneId: 'zoneless' }));
  store.dispatch(undoEncounterChange());
  expect(store.getState().interaction.selection.selectedIds).toEqual(['unchanged']);
  store.dispatch(setActiveTool('zone'));
  store.dispatch(redoEncounterChange());
  expect(store.getState().interaction.activeToolId).toBe('select');
  expect(store.getState().interaction.selection.selectedIds).toEqual(['new']);
});

it('keeps a compatible tool when selecting changed entities', () => {
  enabled();
  const base = actors();
  store.dispatch(setActiveTool('actor'));
  commit('actor.create', createActor(base, { id: 'new', name: 'New', currentZoneId: 'zoneless' }));
  store.dispatch(undoEncounterChange());
  store.dispatch(redoEncounterChange());
  expect(store.getState().interaction.activeToolId).toBe('actor');
  expect(store.getState().interaction.selection.selectedIds).toEqual(['new']);
});

it('selects only the primary type after undoing a cascading Zone deletion and prunes it on redo', () => {
  enabled();
  let base = createZone(store.getState().encounter.present, { id: 'zone', polygon: [
    { x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 200 }, { x: 0, y: 200 }
  ] });
  base = createActor(base, { id: 'resident', name: 'Resident', currentZoneId: 'zone' });
  store.dispatch(loadEncounterState(base));
  store.dispatch(setActiveTool('select'));
  commit('zone.delete', deleteZone(base, 'zone'));
  store.dispatch(undoEncounterChange());
  expect(store.getState().interaction.selection).toMatchObject({ selectedEntityType: 'zone', selectedIds: ['zone'] });
  store.dispatch(redoEncounterChange());
  expect(store.getState().interaction.selection.selectedIds).toEqual([]);
});

it('preserves selection for encounter-only actions and empty history', () => {
  enabled();
  const base = actors();
  commit('encounter.rename', { ...base, name: 'Renamed' });
  store.dispatch(undoEncounterChange());
  store.dispatch(undoEncounterChange());
  store.dispatch(redoEncounterChange());
  store.dispatch(redoEncounterChange());
  expect(store.getState().interaction.selection.selectedIds).toEqual(['unchanged']);
});
