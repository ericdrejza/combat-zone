import { act, fireEvent, screen } from '@testing-library/react';
import { renderApp, getCanvas, mockCanvasBounds } from '@tests/ui/renderApp';
import { store } from '@store/store';
import { setActiveTool } from '@interaction/interactionState';
import { selectLockedRulers, selectRulerDraft } from '@interaction/rulerState';

const points = [{ x: 128, y: 128 }, { x: 256, y: 128 }, { x: 256, y: 256 }, { x: 384, y: 256 }];
function setup(shape = 'Path') {
  renderApp(); mockCanvasBounds(getCanvas()); act(() => store.dispatch(setActiveTool('ruler')));
  fireEvent.click(screen.getByRole('button', { name: `${shape} ruler` }));
}
const surface = () => screen.getByLabelText('Ruler drawing surface');
const place = (p: { x: number; y: number }) => fireEvent.pointerDown(surface(), { button: 0, pointerId: 1, clientX: p.x, clientY: p.y });
const back = (target: Element = surface()) => fireEvent.contextMenu(target, { clientX: 400, clientY: 320 });
const space = () => fireEvent.keyDown(window, { key: ' ', code: 'Space' });

it('picks up path points one at a time, keeping the remaining route and live cursor preview', () => {
  setup(); points.forEach(place);
  for (let remaining = 3; remaining > 0; remaining--) {
    back(); expect(selectRulerDraft(store.getState())?.points).toEqual(points.slice(0, remaining));
    expect(screen.getByLabelText('Ruler preview point')).toBeInTheDocument();
    expect(store.getState().encounter.past).toHaveLength(0);
  }
  back(); expect(selectRulerDraft(store.getState())).toBeNull();
  expect(screen.queryByLabelText('Ruler preview point')).not.toBeInTheDocument();
});
it('locks only the remaining placed path, excluding the picked-up preview', () => {
  setup(); points.forEach(place); back(); space();
  expect(selectLockedRulers(store.getState())[0].points).toEqual(points.slice(0, 3));
  expect(store.getState().encounter.past).toHaveLength(1);
});
it('also picks up the last point when the cursor is over an earlier control point', () => {
  setup(); points.forEach(place); back(screen.getByRole('button', { name: 'Ruler point 1' }));
  expect(selectRulerDraft(store.getState())?.points).toEqual(points.slice(0, 3));
});
it('backtracks over another saved artifact without opening its menu or altering it', () => {
  setup(); points.slice(0, 2).forEach(place); space(); const original = selectLockedRulers(store.getState())[0];
  points.forEach(place); back(document.querySelector('[data-ruler-id] circle')!);
  expect(selectRulerDraft(store.getState())?.points).toEqual(points.slice(0, 3));
  expect(screen.queryByRole('menu', { name: 'Ruler options' })).not.toBeInTheDocument();
  expect(selectLockedRulers(store.getState())).toEqual([original]); expect(store.getState().encounter.past).toHaveLength(1);
});
it('keeps backtracked edits temporary until relocking, with one exact undo step', () => {
  setup(); points.forEach(place); space(); const original = selectLockedRulers(store.getState())[0];
  back(document.querySelector('[data-ruler-id] circle')!);
  fireEvent.click(screen.getByRole('menuitem', { name: 'Edit ruler' })); back();
  expect(selectRulerDraft(store.getState())?.points).toEqual(points.slice(0, 3));
  expect(selectLockedRulers(store.getState())).toEqual([original]); expect(store.getState().encounter.past).toHaveLength(1);
  space(); expect(selectLockedRulers(store.getState())[0].points).toEqual(points.slice(0, 3));
  expect(store.getState().encounter.past).toHaveLength(2);
  fireEvent.keyDown(window, { key: 'z', ctrlKey: true }); expect(selectLockedRulers(store.getState())).toEqual([original]);
});
it.each(['Circle', 'Cone', 'Rectangle', 'Line'])('picks up the endpoint of a %s, allowing replacement', shape => {
  setup(shape); points.slice(0, 2).forEach(place); back();
  expect(selectRulerDraft(store.getState())).toEqual({ points: [points[0]], complete: false });
  space(); expect(selectLockedRulers(store.getState())).toEqual([]);
  place(points[2]); space(); expect(selectLockedRulers(store.getState())[0].points).toEqual([points[0], points[2]]);
});
it('restores a saved ruler if backtracking removes every pending edit point, without deletion history', () => {
  setup(); points.slice(0, 2).forEach(place); space(); const original = selectLockedRulers(store.getState())[0];
  back(document.querySelector('[data-ruler-id] circle')!);
  fireEvent.click(screen.getByRole('menuitem', { name: 'Edit ruler' })); back(); back();
  expect(selectRulerDraft(store.getState())).toBeNull(); expect(selectLockedRulers(store.getState())).toEqual([original]);
  expect(store.getState().encounter.past).toHaveLength(1);
});
