import { act, renderHook } from '@testing-library/react';
import { DEFAULT_KEYBINDS, KEYBIND_DEFINITIONS, KEYBIND_STORAGE_KEY, KeybindProvider, useKeybinds } from '@ui/keybinds';
import { KEYBIND_DEFAULTS_VERSION } from '@ui/keybinds/keybindPreferences';

const legacy = { ...DEFAULT_KEYBINDS, 'actor.rename': 'r', 'tool.ruler': 'd', 'tool.annotation': 'n' };
const setup = () => renderHook(() => useKeybinds(), { wrapper: KeybindProvider });
beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

it('migrates existing snapshots on mount and retains only actual overrides across reloads', () => {
  localStorage.setItem(KEYBIND_STORAGE_KEY, JSON.stringify({ ...legacy, 'actor.healDamage': 'alt+h', ctrlWheelZoomEnabled: false }));
  const first = setup();
  expect(first.result.current.bindings).toEqual({ ...DEFAULT_KEYBINDS, 'actor.healDamage': 'alt+h' });
  expect(first.result.current.ctrlWheelZoomEnabled).toBe(false);
  expect(JSON.parse(localStorage.getItem(KEYBIND_STORAGE_KEY)!)).toEqual({ defaultsVersion: KEYBIND_DEFAULTS_VERSION, ctrlWheelZoomEnabled: false, 'actor.healDamage': 'alt+h' });
  first.unmount();
  const reloaded = setup();
  expect(reloaded.result.current.bindings).toEqual({ ...DEFAULT_KEYBINDS, 'actor.healDamage': 'alt+h' });
});
it.each(KEYBIND_DEFINITIONS.filter(d => d.editable))('persists and reloads a custom override for $id, then removes it on restoring the default', ({ id }) => {
  const first = setup();
  act(() => { expect(first.result.current.setBinding(id, 'alt+q')).toBeNull(); });
  expect(JSON.parse(localStorage.getItem(KEYBIND_STORAGE_KEY)!)).toEqual({ defaultsVersion: KEYBIND_DEFAULTS_VERSION, ctrlWheelZoomEnabled: true, [id]: 'alt+q' });
  first.unmount(); const reloaded = setup();
  expect(reloaded.result.current.bindings[id]).toBe('alt+q');
  act(() => { expect(reloaded.result.current.setBinding(id, DEFAULT_KEYBINDS[id])).toBeNull(); });
  expect(JSON.parse(localStorage.getItem(KEYBIND_STORAGE_KEY)!)).not.toHaveProperty(id);
});
it('synchronizes upgraded preferences and clears overrides on reset', () => {
  const view = setup();
  act(() => {
    localStorage.setItem(KEYBIND_STORAGE_KEY, JSON.stringify({ ...legacy, 'tool.actor': 'j' }));
    window.dispatchEvent(new StorageEvent('storage', { key: KEYBIND_STORAGE_KEY }));
  });
  expect(view.result.current.bindings).toEqual({ ...DEFAULT_KEYBINDS, 'tool.actor': 'j' });
  act(() => view.result.current.resetBindings());
  expect(view.result.current.bindings).toEqual(DEFAULT_KEYBINDS);
  expect(JSON.parse(localStorage.getItem(KEYBIND_STORAGE_KEY)!)).toEqual({ defaultsVersion: KEYBIND_DEFAULTS_VERSION, ctrlWheelZoomEnabled: true });
});
it('keeps in-memory overrides usable when saving preferences fails', () => {
  const view = setup();
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('unavailable'); });
  act(() => { expect(view.result.current.setBinding('tool.ruler', 'j')).toBeNull(); });
  expect(view.result.current.bindings['tool.ruler']).toBe('j');
});

it.each(KEYBIND_DEFINITIONS.filter(d => !d.editable))('rejects attempts to reassign the fixed $id shortcut', ({ id }) => {
  const view = setup();
  act(() => { expect(view.result.current.setBinding(id, 'q')).toBe(id); });
  expect(view.result.current.bindings).toEqual(DEFAULT_KEYBINDS);
  expect(localStorage.getItem(KEYBIND_STORAGE_KEY)).toBeNull();
});
