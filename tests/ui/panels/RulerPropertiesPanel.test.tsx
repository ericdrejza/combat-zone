import { act, fireEvent, screen, within } from '@testing-library/react';
import { renderApp, getCanvas, mockCanvasBounds } from '@tests/ui/renderApp';
import { store } from '@store/store';
import { setActiveTool, setRulerPropertiesTarget, lockRulerDraft, setRulerDraft, editLockedRuler } from '@interaction/interactionState';
import { undoEncounterChange, redoEncounterChange } from '@store/encounterSlice';
import { selectLockedRulers } from '@interaction/rulerState';
import { setPersistenceWritable } from '@store/persistenceWriteGuardMiddleware';

const saved = () => selectLockedRulers(store.getState());
const panel = () => within(screen.getByLabelText('Ruler properties'));
function setup(count = 2) {
  renderApp(); mockCanvasBounds(getCanvas()); act(() => store.dispatch(setActiveTool('ruler')));
  act(() => { store.dispatch(setRulerDraft({ points: [{ x: 128, y: 128 }, { x: 256, y: 128 }, { x: 320, y: 256 }].slice(0, count), complete: false })); store.dispatch(lockRulerDraft()); });
  return saved()[0];
}
function target() {
  fireEvent.contextMenu(document.querySelector('[data-ruler-id] > g')!, { clientX: 128, clientY: 128 });
  expect(screen.getByRole('menu', { name: 'Ruler options' })).toBeInTheDocument();
  fireEvent.pointerDown(screen.getByLabelText('Ruler properties'), { button: 0 });
}
afterEach(() => setPersistenceWritable(true));

it('targets the panel through the existing radial context action and retains it after closing the menu', () => {
  const original = setup(); expect(screen.queryByLabelText('Ruler properties')).not.toBeInTheDocument(); target();
  expect(store.getState().interaction.rulerPropertiesId).toBe(original.id);
  expect(panel().getByRole('textbox', { name: 'Ruler name' })).toBeInTheDocument();
  expect(panel().queryByRole('button', { name: 'Edit ruler' })).not.toBeInTheDocument();
  expect(panel().getByRole('switch', { name: 'Show measurement' })).toHaveAttribute('aria-checked', 'true');
  expect(panel().getByRole('switch', { name: 'Highlight actors' })).toHaveAttribute('aria-checked', 'false');
  expect(panel().getByRole('button', { name: 'Convert to path ruler' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.queryByRole('menu', { name: 'Ruler options' })).not.toBeInTheDocument();
});
it('renames, toggles, converts and deletes a ruler with shared undo/redo', () => {
  const original = setup(); target();
  const name = panel().getByRole('textbox', { name: 'Ruler name' }); fireEvent.change(name, { target: { value: 'Blast' } }); fireEvent.blur(name);
  fireEvent.click(panel().getByRole('switch', { name: 'Show measurement' }));
  fireEvent.click(panel().getByRole('switch', { name: 'Highlight actors' }));
  fireEvent.click(panel().getByRole('button', { name: 'Convert to circle ruler' }));
  const changed = saved()[0]; expect(changed).toMatchObject({ name: 'Blast', options: { shape: 'circle', showDistance: false, highlightActors: true }, points: original.points });
  act(() => store.dispatch(undoEncounterChange())); expect(saved()[0].options.shape).toBe('path');
  act(() => store.dispatch(redoEncounterChange())); expect(saved()[0]).toEqual(changed);
  fireEvent.click(panel().getByRole('button', { name: 'Delete ruler' })); expect(saved()).toEqual([]); expect(screen.queryByLabelText('Ruler properties')).not.toBeInTheDocument();
  act(() => store.dispatch(undoEncounterChange())); expect(saved()).toEqual([changed]);
});
it('disables all AoE conversions for a Path with more than two placed points', () => {
  const original = setup(3); target();
  for (const shape of ['circle', 'cone', 'rectangle', 'line']) expect(panel().getByRole('button', { name: `Convert to ${shape} ruler` })).toBeDisabled();
  expect(panel().getByRole('button', { name: 'Convert to path ruler' })).toBeEnabled();
  fireEvent.click(panel().getByRole('button', { name: 'Convert to circle ruler' })); expect(saved()).toEqual([original]);
  act(() => { store.dispatch(editLockedRuler(original.id)); store.dispatch(setRulerDraft({ points: original.points.slice(0, 2), complete: false })); });
  expect(panel().getByRole('button', { name: 'Convert to circle ruler' })).toBeEnabled();
  fireEvent.click(panel().getByRole('button', { name: 'Convert to circle ruler' })); expect(saved()).toEqual([original]);
  act(() => store.dispatch(lockRulerDraft())); expect(saved()[0].options.shape).toBe('circle'); expect(saved()[0].points).toHaveLength(2);
  act(() => store.dispatch(undoEncounterChange())); expect(saved()).toEqual([original]);
});
it('commits valid color edits without Save/Cancel, rejects invalid hex and restores exact undo/redo', () => {
  const original = setup(); target(); const steps = store.getState().encounter.past.length;
  expect(panel().queryByRole('button', { name: 'Save ruler appearance' })).not.toBeInTheDocument();
  expect(panel().queryByRole('button', { name: 'Cancel ruler appearance' })).not.toBeInTheDocument();
  const hex = panel().getByRole('textbox', { name: 'Ruler color hex color' });
  fireEvent.change(hex, { target: { value: '#abcdef80' } });
  expect(saved()).toEqual([original]);
  fireEvent.blur(hex);
  const changed = saved()[0]; expect(changed).toMatchObject({ color: '#abcdef', opacity: 128 / 255 });
  expect(store.getState().encounter.past).toHaveLength(steps + 1);
  expect(store.getState().interaction.rulerAppearancePreview).toBeNull();
  fireEvent.change(hex, { target: { value: '#invalid' } }); fireEvent.blur(hex);
  expect(hex).toHaveAttribute('aria-invalid', 'true'); expect(saved()).toEqual([changed]);
  fireEvent.keyDown(hex, { key: 'Escape' });
  expect(hex).toHaveValue('#abcdef'); fireEvent.blur(hex);
  expect(store.getState().encounter.past).toHaveLength(steps + 1);
  act(() => store.dispatch(undoEncounterChange())); expect(saved()).toEqual([original]);
  act(() => store.dispatch(redoEncounterChange())); expect(saved()).toEqual([changed]);
});
it('previews opacity during a drag and commits once on release without remounting the slider', () => {
  const original = setup(); target(); const steps = store.getState().encounter.past.length;
  const opacity = panel().getByRole('slider', { name: 'Ruler opacity' });
  opacity.getBoundingClientRect = () => ({ left: 0, width: 116 } as DOMRect);
  fireEvent.pointerDown(opacity, { button: 0, pointerId: 5, clientX: 28 });
  fireEvent.pointerMove(opacity, { pointerId: 5, clientX: 58 });
  expect(store.getState().interaction.rulerAppearancePreview?.opacity).toBe(0.5);
  expect(saved()).toEqual([original]); expect(store.getState().encounter.past).toHaveLength(steps);
  fireEvent.pointerUp(opacity, { button: 0, pointerId: 5, clientX: 68 });
  expect(saved()[0]).toEqual({ ...original, opacity: 0.6 });
  expect(store.getState().encounter.past).toHaveLength(steps + 1);
  expect(panel().getByRole('slider', { name: 'Ruler opacity' })).toBe(opacity);
  fireEvent.blur(opacity); expect(store.getState().encounter.past).toHaveLength(steps + 1);
  act(() => store.dispatch(undoEncounterChange())); expect(saved()).toEqual([original]);
  act(() => store.dispatch(redoEncounterChange())); expect(saved()[0].opacity).toBe(0.6);
});
it('discards cancelled opacity previews and commits keyboard changes on blur', () => {
  const original = setup(); target(); const steps = store.getState().encounter.past.length;
  const opacity = panel().getByRole('slider', { name: 'Ruler opacity' });
  opacity.getBoundingClientRect = () => ({ left: 0, width: 116 } as DOMRect);
  fireEvent.pointerDown(opacity, { button: 0, pointerId: 5, clientX: 28 });
  fireEvent.pointerCancel(opacity, { pointerId: 5 });
  expect(store.getState().interaction.rulerAppearancePreview).toBeNull();
  fireEvent.blur(opacity); expect(saved()).toEqual([original]);
  fireEvent.change(opacity, { target: { value: '0.4' } }); fireEvent.keyUp(opacity, { key: 'ArrowLeft' });
  expect(saved()[0]).toEqual({ ...original, opacity: 0.4 });
  fireEvent.blur(opacity); expect(store.getState().encounter.past).toHaveLength(steps + 1);
});
it('joins panel changes to an existing geometry edit and restores them all on Escape', () => {
  const original = setup(); target(); act(() => store.dispatch(editLockedRuler(original.id)));
  const name = panel().getByRole('textbox', { name: 'Ruler name' }); fireEvent.change(name, { target: { value: 'Pending' } }); fireEvent.blur(name);
  fireEvent.click(panel().getByRole('button', { name: 'Convert to cone ruler' })); fireEvent.click(panel().getByRole('switch', { name: 'Show measurement' }));
  expect(saved()).toEqual([original]); expect(store.getState().encounter.past).toHaveLength(1);
  const hex = panel().getByRole('textbox', { name: 'Ruler color hex color' });
  fireEvent.change(hex, { target: { value: '#abcdef80' } }); fireEvent.blur(hex);
  expect(store.getState().interaction.editingRuler).toMatchObject({ name: 'Pending', color: '#abcdef', opacity: 128 / 255, options: { shape: 'cone', showDistance: false } });
  expect(saved()).toEqual([original]); expect(store.getState().encounter.past).toHaveLength(1);
  fireEvent.keyDown(window, { key: 'Escape' }); expect(saved()).toEqual([original]);
  expect(panel().getByRole('textbox', { name: 'Ruler name' })).toHaveValue(''); expect(store.getState().encounter.past).toHaveLength(1);
});
it('retains the writer boundary even when controls remain enabled after a writer-lock loss', () => {
  const original = setup(); target(); act(() => setPersistenceWritable(false));
  fireEvent.click(panel().getByRole('switch', { name: 'Show measurement' })); fireEvent.click(panel().getByRole('button', { name: 'Convert to circle ruler' }));
  fireEvent.click(panel().getByRole('button', { name: 'Delete ruler' })); expect(saved()).toEqual([original]); expect(store.getState().encounter.past).toHaveLength(1);
});
it('only targets rulers from the Ruler tool and closes the radial menu on tool changes', () => {
  const original = setup(); target();
  act(() => store.dispatch(setActiveTool('grid')));
  expect(screen.queryByLabelText('Ruler properties')).not.toBeInTheDocument();
  fireEvent.contextMenu(document.querySelector('[data-ruler-id] > g')!, { clientX: 128, clientY: 128 });
  expect(screen.queryByRole('menu', { name: 'Ruler options' })).not.toBeInTheDocument();
  expect(store.getState().interaction.rulerPropertiesId).toBeNull();
  act(() => store.dispatch(setActiveTool('ruler'))); target();
  expect(store.getState().interaction.rulerPropertiesId).toBe(original.id);
  fireEvent.contextMenu(document.querySelector('[data-ruler-id] > g')!, { clientX: 128, clientY: 128 });
  expect(screen.getByRole('menu', { name: 'Ruler options' })).toBeInTheDocument();
  act(() => store.dispatch(setActiveTool('select')));
  expect(screen.queryByRole('menu', { name: 'Ruler options' })).not.toBeInTheDocument();
  act(() => store.dispatch(setActiveTool('ruler')));
  expect(screen.queryByRole('menu', { name: 'Ruler options' })).not.toBeInTheDocument();
});

it('always shows the active editing draft, even when the context-menu panel target is cleared', () => {
  const original = setup();
  act(() => { store.dispatch(editLockedRuler(original.id)); store.dispatch(setRulerPropertiesTarget(null)); });
  expect(panel().getByRole('textbox', { name: 'Ruler name' })).toBeInTheDocument();
  fireEvent.click(panel().getByRole('button', { name: 'Convert to circle ruler' }));
  expect(panel().getByRole('button', { name: 'Convert to circle ruler' })).toHaveAttribute('aria-pressed', 'true');
  expect(saved()).toEqual([original]); expect(store.getState().encounter.past).toHaveLength(1);
  const name = panel().getByRole('textbox', { name: 'Ruler name' });
  fireEvent.change(name, { target: { value: 'Cancel typing' } }); fireEvent.keyDown(name, { key: 'Escape' }); fireEvent.blur(name);
  expect(name).toHaveValue(original.name); expect(store.getState().interaction.editingRuler?.options.shape).toBe('circle');
});

it('locks pending panel edits as one undoable action and stays disabled for saved rulers', () => {
  const original = setup(); target(); const steps = store.getState().encounter.past.length;
  expect(panel().getByRole('button', { name: 'Lock ruler' })).toBeDisabled();
  act(() => store.dispatch(editLockedRuler(original.id)));
  expect(panel().getByRole('button', { name: 'Lock ruler' })).toBeEnabled();
  const name = panel().getByRole('textbox', { name: 'Ruler name' });
  fireEvent.change(name, { target: { value: 'Locked edit' } }); fireEvent.blur(name);
  fireEvent.click(panel().getByRole('switch', { name: 'Show measurement' }));
  expect(saved()).toEqual([original]);
  fireEvent.click(panel().getByRole('button', { name: 'Lock ruler' }));
  const updated = saved()[0];
  expect(updated).toMatchObject({ name: 'Locked edit', options: { showDistance: false } });
  expect(store.getState().interaction.editingRuler).toBeNull();
  expect(store.getState().encounter.past).toHaveLength(steps + 1);
  expect(screen.queryByRole('button', { name: 'Ruler point 1' })).not.toBeInTheDocument();
  expect(panel().getByRole('button', { name: 'Lock ruler' })).toBeDisabled();
  act(() => store.dispatch(undoEncounterChange())); expect(saved()).toEqual([original]);
  act(() => store.dispatch(redoEncounterChange())); expect(saved()).toEqual([updated]);
});
it('blocks locking incomplete edits and honors writer-lock loss', () => {
  const original = setup(); target();
  act(() => { store.dispatch(editLockedRuler(original.id)); store.dispatch(setRulerDraft({ points: original.points.slice(0, 1), complete: false })); });
  expect(panel().getByRole('button', { name: 'Lock ruler' })).toBeDisabled();
  act(() => store.dispatch(setRulerDraft({ points: original.points, complete: false })));
  expect(panel().getByRole('button', { name: 'Lock ruler' })).toBeEnabled();
  act(() => setPersistenceWritable(false));
  fireEvent.click(panel().getByRole('button', { name: 'Lock ruler' }));
  expect(saved()).toEqual([original]); expect(store.getState().interaction.editingRuler).not.toBeNull();
  expect(store.getState().encounter.past).toHaveLength(1);
});
