import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { CANVAS_PREFERENCES_KEY, readCanvasPreferences } from '@ui/canvas_preferences/canvasPreferenceStorage';
import { LOCAL_PREFERENCES_RESET_EVENT } from '@ui/motion_preferences/MotionPreferenceProvider';
import { CanvasSettings } from '@ui/settings/CanvasSettings';

beforeEach(() => {
  localStorage.removeItem(CANVAS_PREFERENCES_KEY);
  window.dispatchEvent(new Event(LOCAL_PREFERENCES_RESET_EVENT));
});
afterEach(() => {
  localStorage.removeItem(CANVAS_PREFERENCES_KEY);
  window.dispatchEvent(new Event(LOCAL_PREFERENCES_RESET_EVENT));
});
const toggle = () => screen.getByRole('switch', { name: 'Select on undo/redo' });

it('defaults off, persists the enabled choice, and resets only after confirmation', () => {
  const view = render(<CanvasSettings />);
  expect(toggle()).not.toBeChecked();
  fireEvent.click(toggle());
  expect(readCanvasPreferences().selectOnUndoRedo).toBe(true);
  view.unmount();
  render(<CanvasSettings />);
  expect(toggle()).toBeChecked();
  fireEvent.click(screen.getByRole('button', { name: 'Reset Canvas to defaults' }));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
  expect(toggle()).toBeChecked();
  fireEvent.click(screen.getByRole('button', { name: 'Reset Canvas to defaults' }));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Reset to defaults' }));
  expect(toggle()).not.toBeChecked();
  expect(readCanvasPreferences().selectOnUndoRedo).toBe(false);
});

it('synchronizes cross-tab changes and rejects invalid saved values', () => {
  localStorage.setItem(CANVAS_PREFERENCES_KEY, JSON.stringify({ selectOnUndoRedo: 'true' }));
  render(<CanvasSettings />);
  expect(toggle()).not.toBeChecked();
  act(() => {
    localStorage.setItem(CANVAS_PREFERENCES_KEY, JSON.stringify({ selectOnUndoRedo: true }));
    window.dispatchEvent(new StorageEvent('storage', { key: CANVAS_PREFERENCES_KEY }));
  });
  expect(toggle()).toBeChecked();
});
