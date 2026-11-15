import { act, fireEvent, screen } from '@testing-library/react';
import { renderApp } from '@tests/ui/renderApp';
import { INTERFACE_PREFERENCES_STORAGE_KEY } from '@ui/interface_preferences/InterfacePreferenceProvider';

const originalWidth = window.innerWidth;
afterEach(() => {
  localStorage.removeItem(INTERFACE_PREFERENCES_STORAGE_KEY);
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth });
});

it.each([600, 1200])('starts zoom expanded at width %s when enabled, and permits manual collapse', width => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  localStorage.setItem(INTERFACE_PREFERENCES_STORAGE_KEY, JSON.stringify({ expandZoomControlsOnStart: true }));
  renderApp();
  expect(screen.getByRole('button', { name: 'Zoom in' })).toBeInTheDocument();
  const toggle = screen.getByRole('button', { name: width < 1024 ? 'Zoom controls' : 'Collapse canvas navigation' });
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  fireEvent.click(toggle);
  expect(screen.queryByRole('button', { name: 'Zoom in' })).not.toBeInTheDocument();
});

it('applies a changed preference on the next load without expanding the current controls', () => {
  const view = renderApp();
  expect(screen.getByRole('button', { name: 'Expand canvas navigation' })).toHaveAttribute('aria-expanded', 'false');
  localStorage.setItem(INTERFACE_PREFERENCES_STORAGE_KEY, JSON.stringify({ expandZoomControlsOnStart: true }));
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: INTERFACE_PREFERENCES_STORAGE_KEY })));
  expect(screen.queryByRole('button', { name: 'Zoom in' })).not.toBeInTheDocument();
  view.unmount();
  renderApp();
  expect(screen.getByRole('button', { name: 'Zoom in' })).toBeInTheDocument();
});
