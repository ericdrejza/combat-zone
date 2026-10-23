import { act, fireEvent, screen } from '@testing-library/react';
import { frame } from 'motion/react';
import { renderApp, getCanvas, mockCanvasBounds } from '@tests/ui/renderApp';
import { store } from '@store/store';
import { loadEncounterState, undoEncounterChange, redoEncounterChange } from '@store/encounterSlice';
import { editLockedRuler, lockRulerDraft, setActiveTool, setRulerDraft, setRulerOptions } from '@interaction/interactionState';
import { selectLockedRulers, selectRulerDraft } from '@interaction/rulerState';
import type { RulerShape } from '@core/measurement/types';

type Process = Parameters<typeof frame.update>[0];
const placed = [{ x: 128, y: 128 }, { x: 256, y: 128 }];
let scheduled: Process[];
function setup(shape: RulerShape = 'path', snap = false, index = 1, isometric = false) {
  renderApp(); mockCanvasBounds(getCanvas());
  const points = snap && !['circle', 'rectangle'].includes(shape) ? [{ x: 160, y: 160 }, { x: 288, y: 160 }] : placed;
  act(() => {
    const state = store.getState().encounter.present;
    store.dispatch(loadEncounterState({ ...state, grid: { ...state.grid, type: isometric ? 'isometric' : 'square' }, movementRules: { ...state.movementRules, snapToGrid: snap } }));
    store.dispatch(setActiveTool('ruler'));
    store.dispatch(setRulerOptions({ shape }));
    store.dispatch(setRulerDraft({ points, complete: shape !== 'path' }));
    store.dispatch(lockRulerDraft());
    store.dispatch(editLockedRuler(selectLockedRulers(store.getState())[0].id));
  });
  scheduled = [];
  vi.spyOn(frame, 'update').mockImplementation(callback => { scheduled.push(callback); return callback; });
  const handle = screen.getByRole('button', { name: `Ruler point ${index + 1}` });
  const x = Number(handle.getAttribute('cx')), y = Number(handle.getAttribute('cy'));
  // Grab off-center to catch jumps when the handle is first moved.
  fireEvent.pointerDown(handle, { button: 0, pointerId: 2, clientX: x + 2, clientY: y + 2 });
  return { handle, x: x + 2, y: y + 2, points };
}
function move(handle: HTMLElement, x: number, y: number) { fireEvent.pointerMove(handle, { pointerId: 2, clientX: x, clientY: y }); }
function flushFrame() { act(() => { for (const callback of scheduled.splice(0)) callback({ delta: 16, timestamp: 16, isProcessing: true }); }); }
afterEach(() => vi.restoreAllMocks());

it.each(['path', 'circle', 'rectangle', 'cone', 'line'] as const)('coalesces %s endpoint movement and preserves its grab offset without moving other points', shape => {
  const { handle, x, y } = setup(shape);
  for (const delta of [10, 20, 30, 40]) move(handle, x + delta, y + delta);
  expect(scheduled).toHaveLength(1);
  expect(selectRulerDraft(store.getState())?.points).toEqual(placed);
  flushFrame();
  expect(selectRulerDraft(store.getState())?.points).toEqual([placed[0], { x: 296, y: 168 }]);
  move(handle, x - 20, y - 10); flushFrame();
  expect(selectRulerDraft(store.getState())?.points).toEqual([placed[0], { x: 236, y: 118 }]);
  expect(store.getState().encounter.past).toHaveLength(1);
});
it.each(['path', 'rectangle', 'cone', 'line'] as const)('moves a %s origin from the frozen stored point, including derived cone handles', shape => {
  const { handle, x, y, points } = setup(shape, true, 0);
  move(handle, x + 64, y); flushFrame();
  expect(selectRulerDraft(store.getState())?.points).toEqual([{ x: points[0].x + 64, y: points[0].y }, points[1]]);
});
it('skips redundant updates within a snapped path cell', () => {
  const { handle, x, y } = setup('path', true);
  for (const delta of [4, 8, 12]) move(handle, x + delta, y);
  expect(scheduled).toHaveLength(0);
  move(handle, x + 64, y); flushFrame();
  const draft = selectRulerDraft(store.getState());
  for (const delta of [65, 70, 75]) move(handle, x + delta, y);
  expect(scheduled).toHaveLength(0); expect(selectRulerDraft(store.getState())).toBe(draft);
});
it('flushes the final release position and commits one undoable edit', () => {
  const { handle, x, y } = setup(), original = selectLockedRulers(store.getState());
  move(handle, x + 20, y);
  fireEvent.pointerUp(handle, { button: 0, pointerId: 2, clientX: x + 40, clientY: y + 20 });
  const points = [placed[0], { x: 296, y: 148 }];
  expect(selectRulerDraft(store.getState())?.points).toEqual(points);
  fireEvent.keyDown(window, { key: ' ', code: 'Space' }); flushFrame();
  expect(selectLockedRulers(store.getState())[0].points).toEqual(points);
  expect(store.getState().encounter.past).toHaveLength(2);
  act(() => store.dispatch(undoEncounterChange())); expect(selectLockedRulers(store.getState())).toEqual(original);
  act(() => store.dispatch(redoEncounterChange())); expect(selectLockedRulers(store.getState())[0].points).toEqual(points);
});
it.each(['escape', 'cancel', 'reload'] as const)('discards pending point movement after %s', reason => {
  const { handle, x, y } = setup(), original = selectLockedRulers(store.getState());
  move(handle, x + 64, y);
  if (reason === 'escape') fireEvent.keyDown(window, { key: 'Escape' });
  else if (reason === 'cancel') fireEvent.pointerCancel(handle, { pointerId: 2 });
  else act(() => store.dispatch(loadEncounterState(store.getState().encounter.present)));
  const before = selectRulerDraft(store.getState()); flushFrame();
  expect(selectRulerDraft(store.getState())).toEqual(before);
  expect(selectLockedRulers(store.getState())).toEqual(original);
});
it('flushes the pending point position when Space locks mid-drag', () => {
  const { handle, x, y } = setup(); move(handle, x + 64, y);
  fireEvent.keyDown(window, { key: ' ', code: 'Space' }); flushFrame();
  expect(selectLockedRulers(store.getState())[0].points).toEqual([placed[0], { x: 320, y: 128 }]);
  expect(selectRulerDraft(store.getState())).toBeNull();
});

it('keeps a touch-dragged endpoint aligned with the pointer on an isometric grid', () => {
  const { handle, x, y } = setup('line', false, 1, true);
  fireEvent.pointerCancel(handle, { pointerId: 2 });
  // A new touch gesture uses the same pointer capture and final-position path.
  fireEvent.pointerDown(handle, { button: 0, pointerId: 3, pointerType: 'touch', clientX: x, clientY: y });
  fireEvent.pointerMove(handle, { pointerId: 3, pointerType: 'touch', clientX: x + 40, clientY: y + 20 });
  fireEvent.pointerUp(handle, { button: 0, pointerId: 3, pointerType: 'touch', clientX: x + 48, clientY: y + 24 });
  const points = selectRulerDraft(store.getState())!.points;
  expect(points[0]).toEqual(placed[0]);
  expect(points[1].x).toBeCloseTo(304); expect(points[1].y).toBeCloseTo(152);
});
