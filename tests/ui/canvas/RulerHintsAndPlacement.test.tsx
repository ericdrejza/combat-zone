import { act, fireEvent, screen } from '@testing-library/react';
import { renderApp, getCanvas, mockCanvasBounds } from '@tests/ui/renderApp';
import { loadEncounterState } from '@store/encounterSlice';
import { store } from '@store/store';
import { setActiveTool } from '@interaction/interactionState';
import { selectLockedRulers, selectRulerDraft } from '@interaction/rulerState';

function setup() {
  renderApp(); mockCanvasBounds(getCanvas()); act(() => store.dispatch(setActiveTool('ruler')));
  fireEvent.click(screen.getByRole('button', { name: 'Circle ruler' }));
}
const point = (x: number, y: number) => fireEvent.pointerDown(screen.getByLabelText('Ruler drawing surface'), { button: 0, pointerId: 1, clientX: x, clientY: y });
const space = () => fireEvent.keyDown(window, { key: ' ', code: 'Space' });
function pickUp() {
  const end = screen.getByRole('button', { name: 'Ruler point 2' });
  fireEvent.pointerDown(end, { button: 0, pointerId: 2, clientX: 256, clientY: 128 });
  fireEvent.pointerUp(end, { pointerId: 2, clientX: 256, clientY: 128 });
}
it('only advertises locking while the measurement can be locked, and artifact options while idle', () => {
  setup(); expect(screen.queryByText(/Spacebar/i)).not.toBeInTheDocument();
  point(128, 128); expect(screen.queryByText(/Spacebar/i)).not.toBeInTheDocument();
  point(256, 128); expect(screen.getByText(/Spacebar/i)).toBeInTheDocument();
  space(); expect(screen.queryByText(/Spacebar/i)).not.toBeInTheDocument();
  expect(screen.getByText(/Right-click or touch-hold/i)).toBeInTheDocument();
  act(() => store.dispatch(setActiveTool('select')));
  expect(screen.queryByText(/Right-click or touch-hold/i)).not.toBeInTheDocument();
});
it('picks up the second point on click and lets the preview follow the pointer until replaced', () => {
  setup(); point(128, 128); point(256, 128); pickUp();
  expect(selectRulerDraft(store.getState())?.points).toHaveLength(1);
  expect(selectRulerDraft(store.getState())?.complete).toBe(false);
  expect(store.getState().encounter.past).toHaveLength(0);
  expect(screen.queryByText(/Spacebar/i)).not.toBeInTheDocument();
  fireEvent.pointerMove(screen.getByLabelText('Ruler drawing surface'), { pointerId: 1, clientX: 320, clientY: 128 });
  expect(screen.getByLabelText('Measurement result')).toHaveTextContent('15 ft');
  point(320, 128); expect(selectRulerDraft(store.getState())?.complete).toBe(true);
  space(); expect(selectLockedRulers(store.getState())[0].points[1]).toEqual({ x: 320, y: 128 });
  expect(store.getState().encounter.past).toHaveLength(1);
});
it('distinguishes dragging the endpoint from picking it up', () => {
  setup(); point(128, 128); point(256, 128);
  const end = screen.getByRole('button', { name: 'Ruler point 2' });
  fireEvent.pointerDown(end, { button: 0, pointerId: 2, clientX: 256, clientY: 128 });
  fireEvent.pointerMove(end, { pointerId: 2, clientX: 320, clientY: 192 });
  fireEvent.pointerUp(end, { pointerId: 2, clientX: 320, clientY: 192 });
  expect(selectRulerDraft(store.getState())?.points).toHaveLength(2);
  expect(selectRulerDraft(store.getState())?.complete).toBe(true);
  expect(selectRulerDraft(store.getState())?.points[1]).toEqual({ x: 320, y: 192 });
  expect(store.getState().encounter.past).toHaveLength(0);
});
it('keeps endpoint pickup edits temporary until an existing artifact is locked again', () => {
  setup(); point(128, 128); point(256, 128); space();
  const original = selectLockedRulers(store.getState())[0];
  fireEvent.contextMenu(document.querySelector('[data-ruler-id] circle')!, { clientX: 160, clientY: 128 });
  fireEvent.click(screen.getByRole('menuitem', { name: 'Edit ruler' })); pickUp();
  expect(selectLockedRulers(store.getState())).toEqual([original]); expect(store.getState().encounter.past).toHaveLength(1);
  point(384, 128); space(); expect(store.getState().encounter.past).toHaveLength(2);
  fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
  expect(selectLockedRulers(store.getState())).toEqual([original]);
});

it('starts with Path and locks only clicked waypoints, excluding the live cursor point', () => {
  renderApp(); mockCanvasBounds(getCanvas()); act(() => store.dispatch(setActiveTool('ruler')));
  expect(screen.getByRole('button', { name: 'Path ruler' })).toHaveAttribute('aria-pressed', 'true');
  point(128, 128);
  fireEvent.pointerMove(screen.getByLabelText('Ruler drawing surface'), { pointerId: 1, clientX: 256, clientY: 128 });
  expect(screen.getByLabelText('Ruler preview point')).toBeInTheDocument();
  space(); expect(selectLockedRulers(store.getState())).toEqual([]);
  expect(store.getState().encounter.past).toHaveLength(0);
  point(256, 128);
  fireEvent.pointerMove(screen.getByLabelText('Ruler drawing surface'), { pointerId: 1, clientX: 320, clientY: 256 });
  expect(screen.getAllByRole('button', { name: /Ruler point/ })).toHaveLength(2);
  space(); expect(selectLockedRulers(store.getState())[0].points).toEqual([{ x: 128, y: 128 }, { x: 256, y: 128 }]);
  expect(screen.queryByLabelText('Ruler preview point')).not.toBeInTheDocument();
});

it('places snapped points through saved ruler hit targets without modifying the saved artifact', () => {
  setup();
  act(() => store.dispatch(loadEncounterState({ ...store.getState().encounter.present,
    movementRules: { ...store.getState().encounter.present.movementRules, snapToGrid: true } })));
  point(128, 128); point(256, 128); space(); const original = selectLockedRulers(store.getState())[0];
  fireEvent.click(screen.getByRole('button', { name: 'Path ruler' }));
  const hit = document.querySelector('[data-ruler-id] circle')!;
  fireEvent.pointerDown(hit, { button: 0, pointerId: 1, clientX: 160, clientY: 160 });
  expect(selectRulerDraft(store.getState())?.points).toEqual([{ x: 160, y: 160 }]);
  fireEvent.pointerMove(hit, { pointerId: 1, clientX: 224, clientY: 160 });
  expect(screen.getByLabelText('Ruler preview point')).toBeInTheDocument();
  fireEvent.pointerDown(hit, { button: 0, pointerId: 1, clientX: 224, clientY: 160 });
  space(); expect(selectLockedRulers(store.getState())).toHaveLength(2);
  expect(selectLockedRulers(store.getState())[0]).toEqual(original);
  expect(selectLockedRulers(store.getState())[1].points).toEqual([{ x: 160, y: 160 }, { x: 224, y: 160 }]);
  fireEvent.contextMenu(hit, { clientX: 160, clientY: 160 });
  expect(screen.getByRole('menuitem', { name: 'Edit ruler' })).toBeInTheDocument();
});
it('distinguishes touch taps through artifacts from holding for their options', () => {
  setup(); point(128, 128); point(256, 128); space();
  const hit = document.querySelector('[data-ruler-id] circle')!;
  fireEvent.pointerDown(hit, { button: 0, pointerType: 'touch', pointerId: 8, clientX: 160, clientY: 160 });
  fireEvent.pointerUp(hit, { button: 0, pointerType: 'touch', pointerId: 8, clientX: 160, clientY: 160 });
  expect(selectRulerDraft(store.getState())?.points).toHaveLength(1);
  fireEvent.keyDown(window, { key: 'Escape' });
  vi.useFakeTimers();
  try {
    fireEvent.pointerDown(hit, { button: 0, pointerType: 'touch', pointerId: 9, clientX: 160, clientY: 160 });
    act(() => vi.advanceTimersByTime(510));
    fireEvent.pointerUp(hit, { button: 0, pointerType: 'touch', pointerId: 9, clientX: 160, clientY: 160 });
    expect(screen.getByRole('menuitem', { name: 'Edit ruler' })).toBeInTheDocument();
    expect(selectRulerDraft(store.getState())).toBeNull();
    expect(store.getState().encounter.past).toHaveLength(1);
  } finally { vi.useRealTimers(); }
});

it('cancels an unfinished measurement over another artifact without opening its menu', () => {
  setup(); point(128, 128); point(256, 128); space();
  const original = selectLockedRulers(store.getState())[0], hit = document.querySelector('[data-ruler-id] circle')!;
  point(320, 320);
  fireEvent.contextMenu(hit, { clientX: 160, clientY: 160 });
  expect(screen.queryByRole('menu', { name: 'Ruler options' })).not.toBeInTheDocument();
  expect(selectRulerDraft(store.getState())).toBeNull(); expect(selectLockedRulers(store.getState())).toEqual([original]);
  expect(store.getState().encounter.past).toHaveLength(1);
});
it('restores an edited artifact when right-clicking another artifact, without opening options', () => {
  setup(); point(128, 128); point(256, 128); space(); point(384, 384); point(448, 384); space();
  const originals = selectLockedRulers(store.getState()), hits = document.querySelectorAll('[data-ruler-id] circle');
  fireEvent.contextMenu(hits[0], { clientX: 128, clientY: 128 });
  fireEvent.click(screen.getByRole('menuitem', { name: 'Edit ruler' })); pickUp();
  fireEvent.contextMenu(document.querySelector('[data-ruler-id] circle')!, { clientX: 384, clientY: 384 });
  expect(screen.queryByRole('menu', { name: 'Ruler options' })).not.toBeInTheDocument();
  expect(selectRulerDraft(store.getState())).toBeNull(); expect(selectLockedRulers(store.getState())).toEqual(originals);
  expect(store.getState().encounter.past).toHaveLength(2);
});
