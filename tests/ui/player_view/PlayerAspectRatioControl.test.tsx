import { fireEvent, render, screen } from '@testing-library/react';
import { PlayerAspectRatioControl } from '@ui/player_view/PlayerAspectRatioControl';
import { DEFAULT_CANVAS_PREFERENCES, CANVAS_PREFERENCES_KEY, readCanvasPreferences, saveCanvasPreferences } from '@ui/canvas_preferences/canvasPreferenceStorage';

afterEach(() => localStorage.removeItem(CANVAS_PREFERENCES_KEY));

it('applies presets and rejects invalid custom drafts without changing the active frame', () => {
  const change = vi.fn();
  render(<PlayerAspectRatioControl value={{ width: 16, height: 9 }} onChange={change} />);
  fireEvent.change(screen.getByRole('combobox'), { target: { value: '4:3' } });
  expect(change).toHaveBeenLastCalledWith({ width: 4, height: 3 });
  change.mockClear();
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'custom' } });
  fireEvent.change(screen.getByRole('textbox', { name: 'Player aspect ratio width' }), { target: { value: '0' } });
  expect(screen.getByRole('button', { name: 'Apply ratio' })).toBeDisabled();
  expect(change).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole('textbox', { name: 'Player aspect ratio width' }), { target: { value: '1080' } });
  fireEvent.change(screen.getByRole('textbox', { name: 'Player aspect ratio height' }), { target: { value: '1920' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply ratio' }));
  expect(change).toHaveBeenCalledExactlyOnceWith({ width: 9, height: 16 });
});

it('round trips a default aspect ratio and falls back for legacy or invalid preferences', () => {
  expect(readCanvasPreferences().playerAspectRatio).toEqual({ width: 16, height: 9 });
  saveCanvasPreferences({ ...DEFAULT_CANVAS_PREFERENCES, playerAspectRatio: { width: 4, height: 3 } });
  expect(readCanvasPreferences().playerAspectRatio).toEqual({ width: 4, height: 3 });
  localStorage.setItem(CANVAS_PREFERENCES_KEY, JSON.stringify({ playerAspectRatio: { width: -1, height: 720 } }));
  expect(readCanvasPreferences().playerAspectRatio).toEqual({ width: 16, height: 9 });
  localStorage.setItem(CANVAS_PREFERENCES_KEY, '{}');
  expect(readCanvasPreferences().playerAspectRatio).toEqual({ width: 16, height: 9 });
});
