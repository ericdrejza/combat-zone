import { act, fireEvent, screen } from '@testing-library/react';
import { frame } from 'motion/react';
import { renderApp, getCanvas, mockCanvasBounds } from '@tests/ui/renderApp';
import { store } from '@store/store';
import { loadEncounterState, undoEncounterChange, redoEncounterChange } from '@store/encounterSlice';
import { setActiveTool } from '@interaction/interactionState';
import { selectLockedRulers, selectRulerDraft } from '@interaction/rulerState';

type Process = Parameters<typeof frame.update>[0];
const placed = [{ x: 128, y: 128 }, { x: 256, y: 128 }];
let scheduled: Process[];
function setup(snap = false) {
  renderApp(); mockCanvasBounds(getCanvas());
  act(() => {
    const state = store.getState().encounter.present;
    store.dispatch(loadEncounterState({ ...state, movementRules: { ...state.movementRules, snapToGrid: snap } }));
    store.dispatch(setActiveTool('ruler'));
  });
  fireEvent.click(screen.getByRole('button', { name: 'Circle ruler' }));
  for (const p of placed) fireEvent.pointerDown(screen.getByLabelText('Ruler drawing surface'), { button: 0, pointerId: 1, clientX: p.x, clientY: p.y });
  fireEvent.keyDown(window, { key: ' ', code: 'Space' });
  fireEvent.contextMenu(document.querySelector('[data-ruler-id] > g')!, { clientX: 128, clientY: 128 });
  fireEvent.click(screen.getByRole('menuitem', { name: 'Edit ruler' }));
  scheduled = [];
  vi.spyOn(frame, 'update').mockImplementation(callback => { scheduled.push(callback); return callback; });
  const center = screen.getByRole('button', { name: 'Ruler point 1' });
  fireEvent.pointerDown(center, { button: 0, pointerId: 2, clientX: 128, clientY: 128 });
  return center;
}
function move(center: HTMLElement, x: number, y = 128) { fireEvent.pointerMove(center, { pointerId: 2, clientX: x, clientY: y }); }
function flushFrame() { act(() => { const callbacks = scheduled.splice(0); for (const callback of callbacks) callback({ delta: 16, timestamp: 16, isProcessing: true }); }); }
afterEach(() => vi.restoreAllMocks());

it('processes only the latest pointer position per frame, translating from a frozen baseline', () => {
  const center = setup();
  for (const x of [140, 152, 164, 176, 192]) move(center, x);
  expect(scheduled).toHaveLength(1); expect(selectRulerDraft(store.getState())?.points).toEqual(placed);
  flushFrame(); expect(selectRulerDraft(store.getState())?.points).toEqual([{ x: 192, y: 128 }, { x: 320, y: 128 }]);
  move(center, 224); move(center, 256); flushFrame();
  expect(selectRulerDraft(store.getState())?.points).toEqual([{ x: 256, y: 128 }, { x: 384, y: 128 }]);
  move(center, 160); flushFrame();
  expect(selectRulerDraft(store.getState())?.points).toEqual([{ x: 160, y: 128 }, { x: 288, y: 128 }]);
  expect(store.getState().encounter.past).toHaveLength(1);
});
it('does not enqueue or rebuild geometry while pointer motion stays on the same snapped origin', () => {
  const center = setup(true);
  for (const x of [132, 140, 150, 155]) move(center, x);
  expect(scheduled).toHaveLength(0);
  move(center, 170); flushFrame(); const draft = selectRulerDraft(store.getState());
  expect(draft?.points[0]).toEqual({ x: 192, y: 128 });
  for (const x of [175, 185, 195, 205]) move(center, x);
  expect(scheduled).toHaveLength(0); expect(selectRulerDraft(store.getState())).toBe(draft);
});
it('flushes the actual release point immediately and re-locks as one undoable edit', () => {
  const center = setup(), original = selectLockedRulers(store.getState());
  move(center, 192);
  fireEvent.pointerUp(center, { button: 0, pointerId: 2, clientX: 208, clientY: 144 });
  const points = [{ x: 208, y: 144 }, { x: 336, y: 144 }];
  expect(selectRulerDraft(store.getState())?.points).toEqual(points);
  fireEvent.keyDown(window, { key: ' ', code: 'Space' });
  expect(selectLockedRulers(store.getState())[0].points).toEqual(points); expect(store.getState().encounter.past).toHaveLength(2);
  flushFrame(); expect(selectRulerDraft(store.getState())).toBeNull();
  act(() => store.dispatch(undoEncounterChange())); expect(selectLockedRulers(store.getState())).toEqual(original);
  act(() => store.dispatch(redoEncounterChange())); expect(selectLockedRulers(store.getState())[0].points).toEqual(points);
});
it('includes a queued movement when Space locks during a drag', () => {
  const center = setup(); move(center, 224);
  fireEvent.keyDown(window, { key: ' ', code: 'Space' });
  expect(selectLockedRulers(store.getState())[0].points).toEqual([{ x: 224, y: 128 }, { x: 352, y: 128 }]);
  flushFrame(); expect(selectRulerDraft(store.getState())).toBeNull(); expect(store.getState().encounter.past).toHaveLength(2);
});
it.each(['escape', 'pointer cancellation', 'reload'] as const)('discards queued updates on %s without reviving cancelled edits', reason => {
  const center = setup(), original = selectLockedRulers(store.getState()); move(center, 224);
  if (reason === 'escape') fireEvent.keyDown(window, { key: 'Escape' });
  else if (reason === 'pointer cancellation') fireEvent.pointerCancel(center, { pointerId: 2 });
  else act(() => store.dispatch(loadEncounterState(store.getState().encounter.present)));
  const before = selectRulerDraft(store.getState()); flushFrame();
  expect(selectRulerDraft(store.getState())).toEqual(before); expect(selectLockedRulers(store.getState())).toEqual(original);
});
