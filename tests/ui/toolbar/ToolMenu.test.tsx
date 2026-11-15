import { act, fireEvent, screen } from '@testing-library/react';
import { renderApp } from '@tests/ui/renderApp';
import { INTERFACE_PREFERENCES_STORAGE_KEY } from '@ui/interface_preferences/InterfacePreferenceProvider';
import { readPreferences } from '@ui/interface_preferences/interfacePreferenceStorage';
import { store } from '@store/store';

function setMode(toolMenu: string) {
  localStorage.setItem(INTERFACE_PREFERENCES_STORAGE_KEY, JSON.stringify({ toolMenu }));
}

afterEach(() => localStorage.removeItem(INTERFACE_PREFERENCES_STORAGE_KEY));

it('defaults missing and invalid preferences to dropdown on small screens', () => {
  expect(readPreferences().toolMenu).toBe('dropdown_small_screen');
  setMode('unknown');
  expect(readPreferences().toolMenu).toBe('dropdown_small_screen');
  renderApp();
  expect(screen.queryByRole('combobox', { name: 'Choose tool' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Actor' })).toBeInTheDocument();
});

it('switches tools through the dropdown and keeps shortcuts, toggle-off, and subtools working', () => {
  setMode('dropdown');
  renderApp();
  const menu = screen.getByRole('combobox', { name: 'Choose tool' });
  fireEvent.change(menu, { target: { value: 'grid' } });
  expect(store.getState().interaction.activeToolId).toBe('grid');
  expect(screen.getByRole('button', { name: 'Grid' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByLabelText('Grid options')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Actor' })).not.toBeInTheDocument();
  fireEvent.keyDown(window, { key: 'a' });
  expect(menu).toHaveValue('actor');
  expect(screen.getByRole('button', { name: 'Small actor size' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Actor' }));
  expect(menu).toHaveValue('select');
});

it('uses the dropdown only below the compact breakpoint and retains the active tool on resize', () => {
  setMode('dropdown_small_screen');
  const originalWidth = window.innerWidth;
  renderApp();
  try {
    act(() => {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 600 });
      window.dispatchEvent(new Event('resize'));
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'Choose tool' }), { target: { value: 'actor' } });
    act(() => {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1200 });
      window.dispatchEvent(new Event('resize'));
    });
    expect(screen.queryByRole('combobox', { name: 'Choose tool' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Actor' })).toHaveAttribute('aria-pressed', 'true');
  } finally {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth });
  }
});
