import { act, fireEvent, screen } from '@testing-library/react';
import { frame } from 'motion/react';
import { renderApp, getCanvas, mockCanvasBounds } from '@tests/ui/renderApp';
import { store } from '@store/store';
import { loadEncounterState, undoEncounterChange, redoEncounterChange } from '@store/encounterSlice';
import { setActiveTool } from '@interaction/interactionState';
import { selectLockedRulers, selectRulerDraft, selectRulerOptions } from '@interaction/rulerState';
import { coneAngleHandle } from '@core/measurement/coneAngleHandle';
import { setPersistenceWritable } from '@store/persistenceWriteGuardMiddleware';

const points = [{ x: 128, y: 128 }, { x: 256, y: 128 }];
const place = (x: number, y: number) => fireEvent.pointerDown(screen.getByLabelText('Ruler drawing surface'), { button: 0, pointerId: 1, clientX: x, clientY: y });
const lock = () => fireEvent.keyDown(window, { key: ' ', code: 'Space' });
const saved = () => selectLockedRulers(store.getState());
function setup(mode: 'ADVISORY' | 'STRICT' = 'ADVISORY', snap = false) {
  renderApp(); mockCanvasBounds(getCanvas());
  act(() => { const state = store.getState().encounter.present;
    store.dispatch(loadEncounterState({ ...state, movementRules: { ...state.movementRules, snapToGrid: snap }, validationState: { mode, messages: [] } }));
    store.dispatch(setActiveTool('ruler'));
  });
  fireEvent.click(screen.getByRole('button', { name: 'Cone ruler' }));
  const field = screen.getByRole('spinbutton', { name: 'Cone angle' });
  fireEvent.change(field, { target: { value: '90' } }); fireEvent.blur(field);
  place(128, 128); expect(screen.queryByRole('button', { name: 'Cone angle handle' })).not.toBeInTheDocument(); place(256, 128);
}
function begin(pointerType = 'mouse') {
  const handle = screen.getByRole('button', { name: 'Cone angle handle' });
  const geometry = coneAngleHandle(store.getState().encounter.present, selectRulerDraft(store.getState())!.points, selectRulerOptions(store.getState()))!;
  fireEvent.pointerDown(handle, { button: 0, pointerId: 2, pointerType, clientX: geometry.point.x, clientY: geometry.point.y });
  return { handle, geometry };
}
function position(geometry: ReturnType<typeof begin>['geometry'], halfAngle: number) {
  const grid = store.getState().encounter.present.grid;
  // These integration fixtures use an unprojected square grid with no rotation.
  const angle = geometry.direction - halfAngle * Math.PI / 180;
  return { clientX: grid.origin.x + geometry.origin.x + 160 * Math.cos(angle), clientY: grid.origin.y + geometry.origin.y + 160 * Math.sin(angle) };
}
afterEach(() => { vi.restoreAllMocks(); setPersistenceWritable(true); });

it.each(['ADVISORY', 'STRICT'] as const)('edits the angle as a temporary option, retaining exactly two points and one history step on re-lock in %s', mode => {
  setup(mode); lock(); const original = saved()[0];
  expect(screen.queryByRole('button', { name: 'Cone angle handle' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Ruler point/ })).not.toBeInTheDocument();
  fireEvent.contextMenu(document.querySelector('[data-ruler-id] > g')!, { clientX: 128, clientY: 128 });
  fireEvent.click(screen.getByRole('menuitem', { name: 'Edit ruler' }));
  const { handle, geometry } = begin();
  fireEvent.pointerMove(handle, { pointerId: 2, ...position(geometry, 15) });
  fireEvent.pointerUp(handle, { button: 0, pointerId: 2, ...position(geometry, 15) });
  expect(selectRulerOptions(store.getState()).angle).toBe(30); expect(screen.getByRole('spinbutton', { name: 'Cone angle' })).toHaveValue(30);
  expect(selectRulerDraft(store.getState())?.points).toEqual(points); expect(saved()).toEqual([original]); expect(store.getState().encounter.past).toHaveLength(1);
  lock(); const updated = saved()[0];
  expect(screen.queryByRole('button', { name: 'Cone angle handle' })).not.toBeInTheDocument(); expect(updated.options.angle).toBe(30); expect(updated.points).toEqual(points);
  expect(store.getState().encounter.past).toHaveLength(2);
  act(() => store.dispatch(undoEncounterChange())); expect(saved()).toEqual([original]);
  act(() => store.dispatch(redoEncounterChange())); expect(saved()).toEqual([updated]);
});
it.each([false, true])('supports touch dragging without altering range or origin (snapping %s)', snap => {
  setup('ADVISORY', snap); const before = selectRulerDraft(store.getState())!.points;
  const { handle, geometry } = begin('touch');
  fireEvent.pointerMove(handle, { pointerId: 2, pointerType: 'touch', ...position(geometry, 60) });
  fireEvent.pointerUp(handle, { button: 0, pointerId: 2, pointerType: 'touch', ...position(geometry, 60) });
  expect(selectRulerOptions(store.getState()).angle).toBe(120); expect(selectRulerDraft(store.getState())?.points).toEqual(before);
  expect(saved()).toEqual([]); expect(store.getState().encounter.past).toHaveLength(0);
});
it('flushes a queued angle change before Space locks and never replays it after Escape', () => {
  setup(); let scheduled: (() => void) | undefined;
  vi.spyOn(frame, 'update').mockImplementation(callback => { scheduled = () => callback({ delta: 16, timestamp: 16, isProcessing: true }); return callback; });
  const { handle, geometry } = begin(); fireEvent.pointerMove(handle, { pointerId: 2, ...position(geometry, 30) });
  expect(selectRulerOptions(store.getState()).angle).toBe(90);
  lock(); expect(saved()[0].options.angle).toBe(60); act(() => scheduled?.()); expect(selectRulerDraft(store.getState())).toBeNull();
  fireEvent.contextMenu(document.querySelector('[data-ruler-id] > g')!, { clientX: 128, clientY: 128 });
  fireEvent.click(screen.getByRole('menuitem', { name: 'Edit ruler' }));
  const edit = begin(); fireEvent.pointerMove(edit.handle, { pointerId: 2, ...position(edit.geometry, 50) });
  fireEvent.keyDown(window, { key: 'Escape' }); act(() => scheduled?.());
  expect(saved()[0].options.angle).toBe(60); expect(selectRulerDraft(store.getState())).toBeNull(); expect(store.getState().encounter.past).toHaveLength(1);
});
it('keeps initial angle edits out of history and cannot lock them through a read-only boundary', () => {
  setup(); act(() => setPersistenceWritable(false)); const { handle, geometry } = begin();
  fireEvent.pointerMove(handle, { pointerId: 2, ...position(geometry, 15) });
  fireEvent.pointerUp(handle, { button: 0, pointerId: 2, ...position(geometry, 15) }); lock();
  expect(selectRulerOptions(store.getState()).angle).toBe(30); expect(saved()).toEqual([]); expect(store.getState().encounter.past).toHaveLength(0);
});
