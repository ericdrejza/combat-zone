import { selectLockedRulers } from '@interaction/rulerState';
import { act, fireEvent, screen } from '@testing-library/react';
import { renderApp, getCanvas, mockCanvasBounds } from '@tests/ui/renderApp';
import { store } from '@store/store';
import { setActiveTool } from '@interaction/interactionState';

const point = (x: number, y: number) => fireEvent.pointerDown(screen.getByLabelText('Ruler drawing surface'), { button: 0, pointerId: 1, clientX: x, clientY: y });
const space = () => fireEvent.keyDown(window, { key: ' ', code: 'Space' });
const undo = () => fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
function setup() {
  renderApp(); mockCanvasBounds(getCanvas()); act(() => store.dispatch(setActiveTool('ruler')));
  fireEvent.click(screen.getByRole('button', { name: 'Path ruler' }));
}
function open() { fireEvent.contextMenu(document.querySelector('[data-ruler-id] > g')!, { clientX: 150, clientY: 150 }); }
it('keeps drawing out of history, then replays locking with the shared controls and keyboard', () => {
  setup(); point(100, 100); point(200, 100);
  expect(store.getState().encounter.past).toHaveLength(0);
  expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  space(); const original = selectLockedRulers(store.getState())[0];
  expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
  expect(selectLockedRulers(store.getState())).toEqual([]);
  fireEvent.click(screen.getByRole('button', { name: 'Redo' }));
  expect(selectLockedRulers(store.getState())).toEqual([original]);
  open(); fireEvent.click(screen.getByRole('menuitem', { name: 'Edit ruler' }));
  point(200, 200); point(300, 200);
  expect(store.getState().encounter.past).toHaveLength(1);
  expect(selectLockedRulers(store.getState())).toEqual([original]);
  space(); expect(store.getState().encounter.past).toHaveLength(2);
  undo(); expect(selectLockedRulers(store.getState())).toEqual([original]);
  expect(store.getState().interaction.editingRuler).toBeNull();
  fireEvent.keyDown(window, { key: 'z', ctrlKey: true, shiftKey: true });
  expect(selectLockedRulers(store.getState())[0].points).toHaveLength(4);
});
it('restores the last locked version on Escape without an undo step', () => {
  setup(); point(100, 100); point(200, 100); space();
  const original = selectLockedRulers(store.getState())[0];
  open(); fireEvent.click(screen.getByRole('menuitem', { name: 'Edit ruler' })); point(200, 200);
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(selectLockedRulers(store.getState())).toEqual([original]);
  expect(store.getState().interaction.editingRuler).toBeNull(); expect(store.getState().encounter.past).toHaveLength(1);
  expect(document.querySelector('[data-ruler-id]')).toBeInTheDocument();
});
it('undoes a whole color session and contextual deletion', () => {
  setup(); point(100, 100); point(200, 100); space();
  const original = selectLockedRulers(store.getState())[0];
  open(); fireEvent.click(screen.getByRole('menuitem', { name: 'Choose ruler color' }));
  const opacity = screen.getByRole('slider', { name: 'Artifact opacity' });
  fireEvent.change(opacity, { target: { value: '0.7' } }); fireEvent.change(opacity, { target: { value: '0.4' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(store.getState().encounter.past).toHaveLength(2);
  undo(); expect(selectLockedRulers(store.getState())).toEqual([original]);
  open(); fireEvent.click(screen.getByRole('menuitem', { name: 'Delete ruler' }));
  expect(selectLockedRulers(store.getState())).toEqual([]);
  undo(); expect(selectLockedRulers(store.getState())).toEqual([original]);
});
