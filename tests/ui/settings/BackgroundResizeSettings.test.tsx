import { act, fireEvent, render, screen } from '@testing-library/react';
import { BackgroundResizeSettings } from '@ui/settings/BackgroundResizeSettings';
import { InterfacePreferenceProvider, INTERFACE_PREFERENCES_STORAGE_KEY, readBackgroundResizeOverflowPreference } from '@ui/interface_preferences/InterfacePreferenceProvider';
import { LOCAL_PREFERENCES_RESET_EVENT } from '@ui/motion_preferences/MotionPreferenceProvider';

const label = 'When background resizing puts actors outside the canvas';
function renderSettings() { return render(<InterfacePreferenceProvider><BackgroundResizeSettings /></InterfacePreferenceProvider>); }
afterEach(() => localStorage.removeItem(INTERFACE_PREFERENCES_STORAGE_KEY));

it('defaults to Zoneless, persists both options, reloads, synchronizes, and resets', () => {
  const view = renderSettings();
  const select = screen.getByRole('combobox', { name: label });
  expect(select).toHaveValue('zoneless');
  expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual(['Move actors to Zoneless', 'Limit resizing to keep actors on canvas']);
  fireEvent.change(select, { target: { value: 'clamp' } });
  expect(readBackgroundResizeOverflowPreference()).toBe('clamp');
  view.unmount(); renderSettings();
  expect(screen.getByLabelText(label)).toHaveValue('clamp');
  localStorage.setItem(INTERFACE_PREFERENCES_STORAGE_KEY, JSON.stringify({ backgroundResizeOverflowBehavior: 'zoneless' }));
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: INTERFACE_PREFERENCES_STORAGE_KEY })));
  expect(screen.getByLabelText(label)).toHaveValue('zoneless');
  fireEvent.change(screen.getByLabelText(label), { target: { value: 'clamp' } });
  localStorage.removeItem(INTERFACE_PREFERENCES_STORAGE_KEY);
  act(() => window.dispatchEvent(new Event(LOCAL_PREFERENCES_RESET_EVENT)));
  expect(screen.getByLabelText(label)).toHaveValue('zoneless');
  expect(readBackgroundResizeOverflowPreference()).toBe('zoneless');
});

it.each([undefined, 'unknown', null, 1])('falls back safely for saved preference %s', value => {
  localStorage.setItem(INTERFACE_PREFERENCES_STORAGE_KEY, JSON.stringify({ backgroundResizeOverflowBehavior: value }));
  renderSettings(); expect(screen.getByLabelText(label)).toHaveValue('zoneless');
  expect(readBackgroundResizeOverflowPreference()).toBe('zoneless');
});
