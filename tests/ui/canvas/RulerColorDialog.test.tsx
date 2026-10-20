import { act, fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp, getCanvas, mockCanvasBounds } from '@tests/ui/renderApp';
import { store } from '@store/store';
import { setActiveTool } from '@interaction/interactionState';
import { selectLockedRulers } from '@interaction/rulerState';

const saved = () => selectLockedRulers(store.getState())[0];
function setup() {
  renderApp(); mockCanvasBounds(getCanvas()); act(() => store.dispatch(setActiveTool('ruler')));
  const surface = screen.getByLabelText('Ruler drawing surface');
  for (const x of [128, 256]) fireEvent.pointerDown(surface, { button: 0, pointerId: 1, clientX: x, clientY: 128 });
  fireEvent.keyDown(window, { key: ' ', code: 'Space' });
  open(); return saved();
}
function open() {
  fireEvent.contextMenu(document.querySelector('[data-ruler-id] circle')!, { clientX: 128, clientY: 128 });
  fireEvent.click(screen.getByRole('menuitem', { name: 'Choose ruler color' }));
}
it('toggles the picker closed while retaining access to the dialog fields and actions', () => {
  setup(); const picker = screen.getByRole('button', { name: 'Artifact color' });
  fireEvent.click(picker); expect(picker).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByRole('group', { name: 'Artifact color palette' })).toBeInTheDocument();
  fireEvent.click(picker); expect(picker).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByRole('group', { name: 'Artifact color palette' })).not.toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'Artifact hex color' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Save' })).toBeVisible();
});
it('discards pending custom colors and opacity on Cancel without adding history', () => {
  const original = setup(); fireEvent.click(screen.getByRole('button', { name: 'Artifact color' }));
  fireEvent.change(screen.getByRole('slider', { name: 'Artifact color red' }), { target: { value: '255' } });
  fireEvent.change(screen.getByRole('slider', { name: 'Artifact opacity' }), { target: { value: '0.4' } });
  expect(saved()).toEqual(original); expect(store.getState().encounter.past).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByRole('dialog', { name: 'Ruler color' })).not.toBeInTheDocument();
  expect(saved()).toEqual(original); expect(store.getState().encounter.past).toHaveLength(1);
  open(); expect(screen.getByRole('slider', { name: 'Artifact opacity' })).toHaveValue('1');
});
it('saves pending hex/alpha edits once, including blur on Save, with exact undo/redo', async () => {
  const user = userEvent.setup(), original = setup();
  const hex = screen.getByRole('textbox', { name: 'Artifact hex color' });
  await user.clear(hex); await user.type(hex, '#abcdef80');
  expect(saved()).toEqual(original);
  await user.click(screen.getByRole('button', { name: 'Save' }));
  expect(saved()).toMatchObject({ color: '#abcdef', opacity: 128 / 255 });
  expect(store.getState().encounter.past).toHaveLength(2);
  fireEvent.keyDown(window, { key: 'z', ctrlKey: true }); expect(saved()).toEqual(original);
  fireEvent.keyDown(window, { key: 'z', ctrlKey: true, shiftKey: true });
  expect(saved()).toMatchObject({ color: '#abcdef', opacity: 128 / 255 });
});
it('closes the palette on Escape before cancelling the dialog on the next Escape', () => {
  const original = setup(), picker = screen.getByRole('button', { name: 'Artifact color' });
  fireEvent.click(picker);
  fireEvent.change(screen.getByRole('slider', { name: 'Artifact color blue' }), { target: { value: '255' } });
  fireEvent.keyDown(picker, { key: 'Escape' });
  expect(screen.getByRole('dialog', { name: 'Ruler color' })).toBeInTheDocument();
  expect(picker).toHaveAttribute('aria-expanded', 'false');
  fireEvent.keyDown(picker, { key: 'Escape' });
  expect(screen.queryByRole('dialog', { name: 'Ruler color' })).not.toBeInTheDocument();
  expect(saved()).toEqual(original); expect(store.getState().encounter.past).toHaveLength(1);
});
it('blocks invalid hex input and allows recovery through the picker', () => {
  setup(); const hex = screen.getByRole('textbox', { name: 'Artifact hex color' });
  fireEvent.change(hex, { target: { value: '#invalid' } }); fireEvent.blur(hex);
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Artifact color' }));
  fireEvent.change(screen.getByRole('slider', { name: 'Artifact color red' }), { target: { value: '255' } });
  expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
it('does not replace inherited appearance or add history when saved unchanged', () => {
  const original = setup(); fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(saved()).toEqual(original); expect(saved().color).toBeNull(); expect(saved().opacity).toBeNull();
  expect(store.getState().encounter.past).toHaveLength(1);
  open();
  fireEvent.focus(screen.getByRole('textbox', { name: 'Artifact hex color' }));
  fireEvent.blur(screen.getByRole('textbox', { name: 'Artifact hex color' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(saved()).toEqual(original); expect(store.getState().encounter.past).toHaveLength(1);
});
