import { selectLockedRulers } from '@interaction/rulerState';
import { store } from '@store/store';
import { commitEncounterChange, loadEncounterState, undoEncounterChange, redoEncounterChange, clearEncounterHistory } from '@store/encounterSlice';
import { setPersistenceWritable } from '@store/persistenceWriteGuardMiddleware';
import { resetEncounterLog } from '@store/encounterLogSlice';
import { createEncounterState } from '@core/encounter/createEncounterState';
import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import { DEFAULT_RULER_OPTIONS, type RulerShape } from '@core/measurement/types';
import { resetInteractionState, setRulerDraft, setRulerOptions, lockRulerDraft, editLockedRuler, updateRulerPoint, removeRulerPoint, updateLockedRuler, deleteLockedRuler, clearRulers, setActiveTool } from '@interaction/interactionState';

const points = [{ x: 160, y: 160 }, { x: 288, y: 160 }, { x: 288, y: 288 }];
const history = () => store.getState().encounter;
const rulers = () => selectLockedRulers(store.getState());
function create(shape: RulerShape = 'path') {
  store.dispatch(setRulerOptions({ ...DEFAULT_RULER_OPTIONS, shape }));
  store.dispatch(setRulerDraft({ points, complete: shape !== 'path' }));
  store.dispatch(lockRulerDraft());
  return rulers().at(-1)!;
}
function renameEncounter(name: string) {
  store.dispatch(commitEncounterChange({ action: createEncounterActionRecord('encounter.rename', { name }), nextEncounter: { ...history().present, name } }));
}
beforeEach(() => {
  setPersistenceWritable(true);
  store.dispatch(loadEncounterState(createEncounterState({ id: 'history', name: 'Before' })));
  store.dispatch(resetInteractionState()); store.dispatch(resetEncounterLog());
});
afterEach(() => setPersistenceWritable(true));

it.each(['OFF', 'ADVISORY', 'ASSISTED', 'STRICT'] as const)('undoes and redoes creation and persists the artifact through normal EncounterState history in %s', mode => {
  store.dispatch(loadEncounterState({ ...history().present, validationState: { mode, messages: [] } }));
  const present = history().present, artifact = create(), saved = history().present;
  expect(history().past).toHaveLength(1); expect(history().past[0].action.type).toBe('ruler.create');
  store.dispatch(undoEncounterChange()); expect(rulers()).toEqual([]); expect(history().present).toBe(present);
  store.dispatch(redoEncounterChange()); expect(rulers()).toEqual([artifact]); expect(history().present).toBe(saved);
});
it('never records initial drawing or point edits, and preserves redo while drawing', () => {
  const artifact = create(); store.dispatch(undoEncounterChange());
  store.dispatch(setRulerDraft({ points: [points[0]], complete: false }));
  store.dispatch(updateRulerPoint({ id: null, index: 0, point: points[1] }));
  store.dispatch(setRulerOptions({ angle: 45 }));
  expect(history().past).toHaveLength(0); expect(history().future).toHaveLength(1);
  const draft = store.getState().interaction.rulerDraft;
  store.dispatch(redoEncounterChange()); expect(rulers()).toEqual([artifact]);
  expect(store.getState().interaction.rulerDraft).toEqual(draft);
});
it.each(['path', 'circle', 'cone', 'rectangle', 'line'] as const)('commits a whole %s editing session as one step at re-lock', shape => {
  const original = create(shape); store.dispatch(editLockedRuler(original.id));
  store.dispatch(updateRulerPoint({ id: original.id, index: 1, point: { x: 416, y: 160 } }));
  store.dispatch(setRulerDraft({ points: [...points, { x: 416, y: 416 }], complete: shape !== 'path' }));
  store.dispatch(setRulerOptions({ angle: 35 }));
  expect(rulers()).toEqual([original]); expect(history().past).toHaveLength(1);
  store.dispatch(lockRulerDraft()); const changed = rulers()[0];
  expect(changed.points).toHaveLength(4); expect(changed.options.angle).toBe(35);
  expect(history().past).toHaveLength(2); expect(store.getState().interaction.editingRuler).toBeNull();
  store.dispatch(undoEncounterChange()); expect(rulers()).toEqual([original]);
  store.dispatch(redoEncounterChange()); expect(rulers()).toEqual([changed]);
});
it('cancels edits without history or changes to the locked artifact', () => {
  const original = create(); store.dispatch(editLockedRuler(original.id));
  store.dispatch(updateRulerPoint({ id: original.id, index: 0, point: { x: 500, y: 500 } }));
  store.dispatch(setRulerDraft(null)); expect(rulers()).toEqual([original]); expect(history().past).toHaveLength(1);
  store.dispatch(editLockedRuler(original.id)); store.dispatch(setRulerOptions({ angle: 25 }));
  store.dispatch(setActiveTool('select')); expect(rulers()).toEqual([original]); expect(history().past).toHaveLength(1);
});
it('does not record unchanged re-locks or invalidate redo', () => {
  const first = create(); create(); store.dispatch(undoEncounterChange());
  store.dispatch(editLockedRuler(first.id)); store.dispatch(lockRulerDraft([...points]));
  expect(history().past).toHaveLength(1); expect(history().future).toHaveLength(1);
});
it('restores deleted artifacts and their original ordering, and clears all in one step', () => {
  const a = create(), b = create('circle');
  store.dispatch(deleteLockedRuler(a.id)); expect(rulers()).toEqual([b]);
  store.dispatch(undoEncounterChange()); expect(rulers()).toEqual([a, b]);
  store.dispatch(clearRulers()); expect(rulers()).toEqual([]); expect(history().future).toHaveLength(0);
  store.dispatch(undoEncounterChange()); expect(rulers()).toEqual([a, b]);
  store.dispatch(redoEncounterChange()); expect(rulers()).toEqual([]);
});
it('treats removal of the last edited point as an undoable artifact deletion', () => {
  const original = create(); store.dispatch(editLockedRuler(original.id));
  for (let i = 0; i < points.length; i++) store.dispatch(removeRulerPoint({ id: original.id, index: 0 }));
  expect(rulers()).toEqual([]); expect(history().past).toHaveLength(2);
  store.dispatch(undoEncounterChange()); expect(rulers()).toEqual([original]);
});
it('records names and groups a color-picker session into one appearance step', () => {
  const original = create(); store.dispatch(updateLockedRuler({ id: original.id, name: 'Fireball' }));
  const named = rulers()[0];
  for (const [color, opacity] of [['#ff0000', 0.2], ['#00ff00', 0.4], ['#0000ff', 0.6]] as const) {
    store.dispatch(updateLockedRuler({ id: original.id, color, opacity, historyGroupId: 'picker-session' }));
  }
  expect(history().past).toHaveLength(3); expect(rulers()[0]).not.toHaveProperty('historyGroupId');
  const styled = rulers()[0]; store.dispatch(undoEncounterChange()); expect(rulers()).toEqual([named]);
  store.dispatch(undoEncounterChange()); expect(rulers()).toEqual([original]);
  store.dispatch(redoEncounterChange()); store.dispatch(redoEncounterChange()); expect(rulers()).toEqual([styled]);
  const commits = store.getState().encounterLog.entries.filter(entry => entry.kind === 'commit');
  expect(commits.map(entry => entry.actionType)).toEqual(['ruler.create', 'ruler.rename', 'ruler.appearance']);
});
it('replays ruler and encounter actions together in chronological order', () => {
  const before = history().present, artifact = create(), withRuler = history().present; renameEncounter('After');
  const after = history().present; store.dispatch(deleteLockedRuler(artifact.id)); const deleted = history().present;
  store.dispatch(undoEncounterChange()); expect(rulers()).toEqual([artifact]); expect(history().present).toBe(after);
  store.dispatch(undoEncounterChange()); expect(rulers()).toEqual([artifact]); expect(history().present).toBe(withRuler);
  store.dispatch(undoEncounterChange()); expect(rulers()).toEqual([]); expect(history().present).toBe(before);
  store.dispatch(redoEncounterChange()); expect(rulers()).toEqual([artifact]);
  store.dispatch(redoEncounterChange()); expect(history().present).toBe(after);
  store.dispatch(redoEncounterChange()); expect(rulers()).toEqual([]); expect(history().present).toBe(deleted);
});
it('invalidates the shared redo branch after a new committed action', () => {
  const artifact = create(); renameEncounter('After'); store.dispatch(undoEncounterChange());
  store.dispatch(updateLockedRuler({ id: artifact.id, name: 'New branch' }));
  expect(history().future).toHaveLength(0); expect(history().present.name).toBe('Before');
});
it('centrally blocks all persisted ruler changes and replay in read-only mode', () => {
  const artifact = create(), present = history().present;
  setPersistenceWritable(false);
  create('circle'); store.dispatch(deleteLockedRuler(artifact.id));
  store.dispatch(updateLockedRuler({ id: artifact.id, name: 'Blocked' }));
  store.dispatch(clearRulers()); store.dispatch(undoEncounterChange());
  expect(history().present).toBe(present); expect(rulers()).toEqual([artifact]); expect(history().past).toHaveLength(1);
});
it('keeps saved rulers through fresh history and clears only interaction drafts on load', () => {
  const artifact = create(), snapshot = history().present;
  expect(JSON.stringify(snapshot)).toContain(artifact.id);
  store.dispatch(clearEncounterHistory()); expect(history().past).toHaveLength(0); expect(rulers()).toEqual([artifact]);
  store.dispatch(loadEncounterState(snapshot)); store.dispatch(resetInteractionState());
  expect(history().past).toEqual([]); expect(history().future).toEqual([]); expect(rulers()).toEqual([artifact]);
});
it('does not create history for clearing only an unfinished draft or unknown deletion', () => {
  store.dispatch(setRulerDraft({ points, complete: false })); store.dispatch(clearRulers());
  store.dispatch(deleteLockedRuler('missing'));
  expect(history().past).toHaveLength(0);
});
