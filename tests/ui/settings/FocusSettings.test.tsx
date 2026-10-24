import { fireEvent, render, screen, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { store } from '@store/store';
import { CanvasSettings } from '@ui/settings/CanvasSettings';
import { InterfacePreferenceProvider } from '@ui/interface_preferences/InterfacePreferenceProvider';
import { CANVAS_PREFERENCES_KEY, readCanvasPreferences } from '@ui/canvas_preferences/canvasPreferenceStorage';
import { DEFAULT_FOCUS_PREFERENCES } from '@ui/canvas/focus/focusPreferences';

afterEach(() => localStorage.removeItem(CANVAS_PREFERENCES_KEY));

function renderSettings() {
  return render(<Provider store={store}><InterfacePreferenceProvider><CanvasSettings /></InterfacePreferenceProvider></Provider>);
}

it('persists activation, picker color, flow length and glow, and resets them with Canvas settings', () => {
  const history = store.getState().encounter;
  const view = renderSettings();
  expect(screen.getByRole('combobox', { name: 'Focus activation' })).toHaveValue('hold');
  expect(screen.getByRole('slider', { name: 'Focus tail length' })).toHaveValue('50');
  fireEvent.change(screen.getByRole('combobox', { name: 'Focus activation' }), { target: { value: 'toggle' } });
  fireEvent.change(screen.getByRole('slider', { name: 'Focus tail length' }), { target: { value: '75' } });
  fireEvent.change(screen.getByRole('slider', { name: 'Focus glow intensity' }), { target: { value: '35' } });
  const hex = screen.getByRole('textbox', { name: 'Focus hex color' });
  fireEvent.change(hex, { target: { value: '#00ff44' } });
  fireEvent.blur(hex);
  expect(readCanvasPreferences().focus).toMatchObject({ activation: 'toggle', color: '#00ff44', glowIntensity: 0.35 });
  expect(readCanvasPreferences().focus.tailLength).toBeCloseTo(0.225);
  view.unmount(); renderSettings();
  expect(screen.getByRole('combobox', { name: 'Focus activation' })).toHaveValue('toggle');
  expect(screen.getByRole('slider', { name: 'Focus tail length' })).toHaveValue('75');
  expect(screen.getByRole('slider', { name: 'Focus glow intensity' })).toHaveValue('35');
  expect(screen.getByRole('textbox', { name: 'Focus hex color' })).toHaveValue('#00ff44');
  fireEvent.click(screen.getByRole('button', { name: 'Reset Canvas to defaults' }));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Reset to defaults' }));
  expect(readCanvasPreferences().focus).toEqual(DEFAULT_FOCUS_PREFERENCES);
  expect(store.getState().encounter).toBe(history);
});

it('maps the original 15% tail to the new 50% and caps saved lengths at the new maximum', () => {
  localStorage.setItem(CANVAS_PREFERENCES_KEY, JSON.stringify({ focus: { tailLength: 0.15 } }));
  const view = renderSettings();
  expect(screen.getByRole('slider', { name: 'Focus tail length' })).toHaveValue('50');
  view.unmount();
  localStorage.setItem(CANVAS_PREFERENCES_KEY, JSON.stringify({ focus: { tailLength: 0.9 } }));
  renderSettings();
  expect(screen.getByRole('slider', { name: 'Focus tail length' })).toHaveValue('100');
  expect(readCanvasPreferences().focus.tailLength).toBe(0.3);
});

it('defaults invalid stored Focus values independently and preserves valid values', () => {
  localStorage.setItem(CANVAS_PREFERENCES_KEY, JSON.stringify({ focus: { activation: 'unknown', color: 'bad', tailLength: -1, glowIntensity: 2 } }));
  expect(readCanvasPreferences().focus).toEqual(DEFAULT_FOCUS_PREFERENCES);
  localStorage.setItem(CANVAS_PREFERENCES_KEY, JSON.stringify({ focus: { activation: 'toggle', color: '#ABCDEF', tailLength: 0, glowIntensity: 0 } }));
  expect(readCanvasPreferences().focus).toEqual({ activation: 'toggle', color: '#ABCDEF', tailLength: 0, glowIntensity: 0 });
});
