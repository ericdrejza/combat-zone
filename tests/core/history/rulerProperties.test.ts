import { createEncounterState } from '@core/encounter/createEncounterState';
import type { RulerShape } from '@core/measurement/types';
import { selectRulerPropertiesArtifact } from '@interaction/rulerState';
import { store } from '@store/store';
import { loadEncounterState, undoEncounterChange, redoEncounterChange } from '@store/encounterSlice';
import { setPersistenceWritable } from '@store/persistenceWriteGuardMiddleware';
import { resetInteractionState, setRulerOptions, setRulerDraft, lockRulerDraft, updateLockedRuler, convertLockedRuler, editLockedRuler, setRulerPropertiesTarget, deleteLockedRuler, clearRulers } from '@interaction/interactionState';

const points = [{ x: 128, y: 128 }, { x: 256, y: 128 }, { x: 320, y: 256 }];
const history = () => store.getState().encounter;
const saved = () => history().present.rulers.byId[history().present.rulers.allIds[0]];
function create(count = 2) {
  store.dispatch(setRulerOptions({ shape: 'path' })); store.dispatch(setRulerDraft({ points: points.slice(0, count), complete: false })); store.dispatch(lockRulerDraft());
  store.dispatch(updateLockedRuler({ id: saved().id, name: 'Trail', color: '#123456', opacity: 0.5, options: { shape: 'path', showDistance: false, highlightActors: true } }));
  store.dispatch(setRulerPropertiesTarget(saved().id)); return saved();
}
beforeEach(() => { setPersistenceWritable(true); store.dispatch(resetInteractionState()); store.dispatch(loadEncounterState(createEncounterState({ id: 'ruler-properties', name: 'Properties' }))); });
afterEach(() => setPersistenceWritable(true));

it.each(['circle', 'cone', 'rectangle', 'line'] as RulerShape[])('converts a two-point Path to %s without losing facts, with exact undo/redo', shape => {
  const original = create(); const steps = history().past.length;
  store.dispatch(convertLockedRuler({ id: original.id, shape })); const changed = saved();
  expect(changed).toEqual({ ...original, options: { ...original.options, shape } }); expect(history().past).toHaveLength(steps + 1);
  store.dispatch(undoEncounterChange()); expect(saved()).toEqual(original);
  store.dispatch(redoEncounterChange()); expect(saved()).toEqual(changed);
  store.dispatch(convertLockedRuler({ id: original.id, shape: 'path' })); expect(saved()).toEqual(original);
});
it('blocks longer Path conversion through conversion commands, appearance commands, and editing options', () => {
  const original = create(3), snapshot = history().present, steps = history().past.length;
  store.dispatch(convertLockedRuler({ id: original.id, shape: 'circle' }));
  store.dispatch(updateLockedRuler({ id: original.id, options: { shape: 'cone' } }));
  expect(history().present).toBe(snapshot); expect(history().past).toHaveLength(steps);
  store.dispatch(editLockedRuler(original.id)); store.dispatch(setRulerOptions({ shape: 'rectangle' }));
  store.dispatch(convertLockedRuler({ id: original.id, shape: 'line' }));
  expect(store.getState().interaction.editingRuler).toEqual(original);
});
it.each(['ADVISORY', 'STRICT'] as const)('joins all panel edits to the geometry draft and commits once at re-lock in %s', mode => {
  store.dispatch(loadEncounterState({ ...history().present, validationState: { mode, messages: [] } }));
  const original = create(), steps = history().past.length;
  store.dispatch(editLockedRuler(original.id));
  store.dispatch(updateLockedRuler({ id: original.id, name: 'Blast', color: '#abcdef', opacity: 0.25, options: { ...original.options, showDistance: true, highlightActors: false } }));
  store.dispatch(convertLockedRuler({ id: original.id, shape: 'circle' }));
  const draft = selectRulerPropertiesArtifact(store.getState()); expect(draft).toMatchObject({ name: 'Blast', color: '#abcdef', opacity: 0.25, options: { shape: 'circle', showDistance: true, highlightActors: false } });
  expect(saved()).toEqual(original); expect(history().past).toHaveLength(steps);
  store.dispatch(lockRulerDraft()); expect(saved()).toEqual(draft); expect(history().past).toHaveLength(steps + 1);
  store.dispatch(undoEncounterChange()); expect(saved()).toEqual(original);
  store.dispatch(redoEncounterChange()); expect(saved()).toEqual(draft);
});
it('cancels properties with the geometry draft and preserves the original artifact', () => {
  const original = create(), steps = history().past.length; store.dispatch(editLockedRuler(original.id));
  store.dispatch(updateLockedRuler({ id: original.id, name: 'Cancelled' })); store.dispatch(convertLockedRuler({ id: original.id, shape: 'cone' }));
  store.dispatch(setRulerDraft(null)); expect(selectRulerPropertiesArtifact(store.getState())).toEqual(original); expect(history().past).toHaveLength(steps);
});
it('blocks saved and in-progress panel changes centrally without writer access', () => {
  const original = create(), steps = history().past.length; setPersistenceWritable(false);
  store.dispatch(convertLockedRuler({ id: original.id, shape: 'circle' })); store.dispatch(updateLockedRuler({ id: original.id, name: 'Blocked' })); store.dispatch(deleteLockedRuler(original.id));
  expect(saved()).toEqual(original); expect(history().past).toHaveLength(steps);
  setPersistenceWritable(true); store.dispatch(editLockedRuler(original.id)); setPersistenceWritable(false);
  store.dispatch(updateLockedRuler({ id: original.id, name: 'Blocked draft' })); store.dispatch(convertLockedRuler({ id: original.id, shape: 'cone' }));
  expect(store.getState().interaction.editingRuler).toEqual(original);
});
it('clears panel targets on deletion, clear, and snapshot reload without storing them in the encounter', () => {
  let original = create(); expect(selectRulerPropertiesArtifact(store.getState())).toEqual(original);
  store.dispatch(deleteLockedRuler(original.id)); expect(store.getState().interaction.rulerPropertiesId).toBeNull();
  store.dispatch(undoEncounterChange()); store.dispatch(setRulerPropertiesTarget(original.id)); store.dispatch(clearRulers()); expect(selectRulerPropertiesArtifact(store.getState())).toBeNull();
  original = create(); store.dispatch(editLockedRuler(original.id)); store.dispatch(loadEncounterState(history().present)); expect(store.getState().interaction.rulerPropertiesId).toBeNull();
  expect(store.getState().interaction.editingRuler).toBeNull(); expect(selectRulerPropertiesArtifact(store.getState())).toBeNull();
  expect(history().present).not.toHaveProperty('rulerPropertiesId'); expect(saved()).toEqual(original);
});
