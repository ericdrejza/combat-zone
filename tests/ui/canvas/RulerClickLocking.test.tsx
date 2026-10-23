import { measureArea } from '@core/measurement/areaGeometry';
import { act, fireEvent, screen } from '@testing-library/react';
import { renderApp, getCanvas, mockCanvasBounds } from '@tests/ui/renderApp';
import { loadEncounterState, undoEncounterChange, redoEncounterChange } from '@store/encounterSlice';
import { store } from '@store/store';
import { setActiveTool } from '@interaction/interactionState';
import { selectLockedRulers, selectRulerDraft } from '@interaction/rulerState';
import { setPersistenceWritable } from '@store/persistenceWriteGuardMiddleware';

function setup(shape = 'Path') {
  renderApp(); mockCanvasBounds(getCanvas()); act(() => store.dispatch(setActiveTool('ruler')));
  fireEvent.click(screen.getByRole('button', { name: `${shape} ruler` }));
}
const surface = () => screen.getByLabelText('Ruler drawing surface');
const place = (x: number, y: number) => fireEvent.pointerDown(surface(), { button: 0, pointerId: 1, clientX: x, clientY: y });
const saved = () => selectLockedRulers(store.getState());
const space = () => fireEvent.keyDown(window, { key: ' ', code: 'Space' });
afterEach(() => setPersistenceWritable(true));

it.each(['Path', 'Circle', 'Cone', 'Rectangle', 'Line'])('locks %s by clicking after placing its points, with exact undo/redo', shape => {
  setup(shape); place(128, 128); place(256, 128);
  fireEvent.pointerMove(surface(), { pointerId: 1, clientX: 400, clientY: 400 });
  place(shape === 'Path' ? 134 : 400, shape === 'Path' ? 132 : 400);
  const artifact = saved()[0]; expect(artifact.points).toEqual([{ x: 128, y: 128 }, { x: 256, y: 128 }]);
  expect(selectRulerDraft(store.getState())).toBeNull(); expect(store.getState().encounter.past).toHaveLength(1);
  act(() => store.dispatch(undoEncounterChange())); expect(saved()).toEqual([]);
  act(() => store.dispatch(redoEncounterChange())); expect(saved()).toEqual([artifact]);
});
it('locks a path by clicking an editable waypoint, while dragging still adjusts it', () => {
  setup(); place(128, 128); place(256, 128); place(320, 256);
  const point = screen.getByRole('button', { name: 'Ruler point 2' });
  fireEvent.pointerDown(point, { button: 0, pointerId: 2, clientX: 256, clientY: 128 });
  fireEvent.pointerMove(point, { pointerId: 2, clientX: 280, clientY: 160 });
  fireEvent.pointerUp(point, { pointerId: 2, clientX: 280, clientY: 160 });
  expect(saved()).toEqual([]); expect(selectRulerDraft(store.getState())?.points[1]).toEqual({ x: 280, y: 160 });
  fireEvent.pointerDown(point, { button: 0, pointerId: 3, clientX: 280, clientY: 160 });
  fireEvent.pointerUp(point, { pointerId: 3, clientX: 280, clientY: 160 });
  expect(saved()[0].points).toHaveLength(3);
});
it('keeps the near-point lock radius in screen pixels when zoomed', () => {
  setup(); place(128, 128); place(256, 128);
  Object.defineProperty(getCanvas(), 'getScreenCTM', { configurable: true, value: () => ({ a: 2, b: 0, c: 0, d: 2, e: 0, f: 0 }) });
  place(270, 256); expect(saved()).toEqual([]); // 14 screen pixels from the first point.
  place(264, 256); expect(saved()[0].points).toHaveLength(3);
});
it('keeps Space as an alternative and rejects click locking without writer access', () => {
  setup(); place(128, 128); place(256, 128); act(() => setPersistenceWritable(false));
  place(128, 128); space(); expect(saved()).toEqual([]); expect(selectRulerDraft(store.getState())?.points).toHaveLength(2);
  act(() => setPersistenceWritable(true)); space(); expect(saved()).toHaveLength(1);
});
it.each([false, true])('translates a circle by its center without changing its radius (snapping %s)', snap => {
  setup('Circle');
  act(() => { const state = store.getState().encounter.present; store.dispatch(loadEncounterState({ ...state, movementRules: { ...state.movementRules, snapToGrid: snap } })); });
  place(128, 128); place(256, 128); space(); const original = saved()[0];
  fireEvent.contextMenu(document.querySelector('[data-ruler-id] > g')!, { clientX: 128, clientY: 128 });
  fireEvent.click(screen.getByRole('menuitem', { name: 'Edit ruler' }));
  const center = screen.getByRole('button', { name: 'Ruler point 1' });
  fireEvent.pointerDown(center, { button: 0, pointerId: 2, clientX: 128, clientY: 128 });
  fireEvent.pointerMove(center, { pointerId: 2, clientX: 192, clientY: 256 });
  fireEvent.pointerUp(center, { pointerId: 2, clientX: 192, clientY: 256 });
  expect(selectRulerDraft(store.getState())?.points).toEqual([{ x: 192, y: 256 }, { x: 320, y: 256 }]);
  expect(saved()).toEqual([original]); expect(store.getState().encounter.past).toHaveLength(1);
  place(400, 400); const moved = saved()[0]; expect(moved.points).toEqual([{ x: 192, y: 256 }, { x: 320, y: 256 }]);
  act(() => store.dispatch(undoEncounterChange())); expect(saved()).toEqual([original]);
  act(() => store.dispatch(redoEncounterChange())); expect(saved()).toEqual([moved]);
});

it('preserves a circle radius when translating across a warped grid', () => {
  setup('Circle');
  act(() => { const state = store.getState().encounter.present; store.dispatch(loadEncounterState({ ...state,
    grid: { ...state.grid, warp: { type: 'bilinear', x: [0, 1, 0, 0.04], y: [0, 0, 1, 0.02] } },
    movementRules: { ...state.movementRules, snapToGrid: false } })); });
  place(128, 128); place(256, 128);
  const encounter = store.getState().encounter.present, before = selectRulerDraft(store.getState())!.points;
  const radius = measureArea(encounter, before[0], before[1], { shape: 'circle' }).distance;
  const center = screen.getByRole('button', { name: 'Ruler point 1' });
  fireEvent.pointerDown(center, { button: 0, pointerId: 2, clientX: 128, clientY: 128 });
  fireEvent.pointerMove(center, { pointerId: 2, clientX: 256, clientY: 256 });
  fireEvent.pointerUp(center, { pointerId: 2, clientX: 256, clientY: 256 });
  const after = selectRulerDraft(store.getState())!.points;
  expect(after[0].x).toBeCloseTo(256); expect(after[0].y).toBeCloseTo(256);
  expect(measureArea(encounter, after[0], after[1], { shape: 'circle' }).distance).toBeCloseTo(radius, 8);
  expect(store.getState().encounter.past).toHaveLength(0);
});
