import { DEFAULT_KEYBINDS, KEYBIND_DEFINITIONS, bindingsConflict, isKeybind, matchesKeybind, type KeybindMap } from '@ui/keybinds/keybindDefinitions';
import { decodeKeybindPreferences, encodeKeybindPreferences, KEYBIND_DEFAULTS_VERSION } from '@ui/keybinds/keybindPreferences';

// Independent contract: adding or changing a shortcut requires updating its behavioral cases.
const expected: KeybindMap = {
  'canvas.focus': 'f',
  'player.preview': 'v', 'player.popout': 'ctrl+shift+v',
  'history.undo': 'mod+z', 'history.redo': 'mod+shift+z',
  'actor.moveUp': 'arrowup', 'actor.moveDown': 'arrowdown', 'actor.moveLeft': 'arrowleft', 'actor.moveRight': 'arrowright',
  'actor.sizeDecrease': 'shift+minus', 'actor.sizeIncrease': 'shift+plus', 'actor.healDamage': 'h',
  'library.open': 'l', 'audio.toggle': 'p', 'panels.toggle': 'q',
  'viewport.panUp': '', 'viewport.panDown': '', 'viewport.panLeft': '', 'viewport.panRight': '',
  'viewport.zoomOut': 'minus', 'viewport.zoomIn': 'plus',
  'viewport.fitWidth': 'ctrl+arrowleft', 'viewport.fitHeight': 'ctrl+arrowright', 'viewport.fit': 'ctrl+arrowup', 'viewport.reset': 'ctrl+arrowdown',
  'initiative.toggle': 'i', 'actor.copy': 'mod+c', 'actor.paste': 'mod+v', 'actor.rename': 'n',
  'actor.showFactionOutlines': 'o', 'selection.selectAll': 'mod+a',
  'tool.ruler': 'r', 'tool.actor': 'a', 'tool.audio': 'm', 'tool.annotation': 't', 'tool.background': 'b',
  'tool.edge': 'e', 'tool.select': 's', 'tool.zone': 'z', 'workspace.save': 'mod+s'
};
it('preserves an existing F customization instead of displacing it with Focus', () => {
  const { bindings } = decodeKeybindPreferences({ defaultsVersion: 2, 'tool.actor': 'f' });
  expect(bindings['tool.actor']).toBe('f');
  expect(bindings['canvas.focus']).toBe('');
});
function eventFor(binding: string, platform: 'ctrl' | 'meta') {
  const parts = binding.replace('mod+', `${platform}+`).split('+'), key = parts.at(-1)!;
  return new KeyboardEvent('keydown', { key: key === 'plus' ? '+' : key === 'minus' ? '-' : key,
    ctrlKey: parts.includes('ctrl'), metaKey: parts.includes('meta'), altKey: parts.includes('alt'), shiftKey: parts.includes('shift') });
}
const legacy = { ...expected, 'actor.rename': 'r', 'tool.ruler': 'd', 'tool.annotation': 'n' };

it('covers every declared shortcut exactly once', () => {
  expect(Object.keys(expected).sort()).toEqual(KEYBIND_DEFINITIONS.map(d => d.id).sort());
});
it.each(Object.entries(expected))('%s resolves and matches its default with the documented Plus alias', (id, binding) => {
  const resolved = decodeKeybindPreferences(null).bindings;
  expect(resolved[id as keyof KeybindMap]).toBe(binding); expect(isKeybind(binding)).toBe(true);
  for (const platform of ['ctrl', 'meta'] as const) {
    if (!binding) { expect(matchesKeybind(new KeyboardEvent('keydown', { key: 'q' }), resolved[id as keyof KeybindMap])).toBe(false); continue; }
    const event = eventFor(binding, platform);
    expect(Object.entries(resolved).filter(([, chord]) => matchesKeybind(event, chord)).map(([action]) => action)).toEqual(id === 'actor.sizeIncrease' ? ['actor.sizeIncrease', 'viewport.zoomIn'] : [id]);
    expect(matchesKeybind(eventFor(`alt+${binding}`, platform), binding)).toBe(false);
  }
});
it('has no conflicting default assignments', () => {
  const values = Object.entries(DEFAULT_KEYBINDS);
  for (const [index, [id, binding]] of values.entries()) for (const [otherId, other] of values.slice(index + 1)) {
    expect(bindingsConflict(binding, other), `${id} conflicts with ${otherId}`).toBe(false);
  }
});
it('migrates a full legacy snapshot to new defaults and stores no inherited shortcuts', () => {
  const preferences = decodeKeybindPreferences({ ...legacy, ctrlWheelZoomEnabled: false });
  expect(preferences).toEqual({ bindings: expected, ctrlWheelZoomEnabled: false });
  const saved = encodeKeybindPreferences(preferences.bindings, preferences.ctrlWheelZoomEnabled);
  expect(saved).toEqual({ defaultsVersion: KEYBIND_DEFAULTS_VERSION, ctrlWheelZoomEnabled: false });
  expect(decodeKeybindPreferences(saved)).toEqual(preferences);
});
it.each(KEYBIND_DEFINITIONS.filter(d => d.editable))('round trips a custom binding and intentional clearing for $id', ({ id }) => {
  for (const binding of ['alt+q', '']) {
    const bindings = { ...DEFAULT_KEYBINDS, [id]: binding };
    const saved = encodeKeybindPreferences(bindings, true);
    expect(decodeKeybindPreferences(saved).bindings).toEqual(bindings);
    expect(Object.keys(saved).filter(key => !['defaultsVersion', 'ctrlWheelZoomEnabled'].includes(key))).toEqual(binding === DEFAULT_KEYBINDS[id] ? [] : [id]);
  }
});
it('preserves real legacy customizations and gives them priority over migrated defaults', () => {
  const preferences = decodeKeybindPreferences({ ...legacy, 'tool.actor': 'r', 'tool.annotation': 'alt+t', 'actor.moveUp': '' });
  expect(preferences.bindings).toMatchObject({ 'tool.actor': 'r', 'tool.ruler': '', 'tool.annotation': 'alt+t', 'actor.moveUp': '', 'actor.rename': 'n' });
  expect(decodeKeybindPreferences(encodeKeybindPreferences(preferences.bindings, true))).toEqual(preferences);
});
it('keeps deliberate legacy-letter overrides after the migration version is recorded', () => {
  expect(decodeKeybindPreferences({ defaultsVersion: 1, 'actor.rename': 'r', 'tool.ruler': 'd', 'tool.annotation': 'n' }).bindings)
    .toEqual(legacy);
});
it('never lets saved data override fixed shortcuts', () => {
  const stored = Object.fromEntries(KEYBIND_DEFINITIONS.filter(d => !d.editable).map(d => [d.id, 'q']));
  expect(decodeKeybindPreferences(stored).bindings).toEqual(DEFAULT_KEYBINDS);
});
it.each([null, [], 'invalid', { 'tool.ruler': 4 }, { 'actor.rename': 'space' }, { defaultsVersion: 999 }])('falls back safely for invalid preferences: %j', stored => {
  expect(decodeKeybindPreferences(stored)).toEqual({ bindings: DEFAULT_KEYBINDS, ctrlWheelZoomEnabled: true });
});

it('migrates inherited Select V to S without losing custom bindings', () => {
  expect(decodeKeybindPreferences({ defaultsVersion: 1, 'tool.select': 'v' }).bindings).toEqual(expected);
  expect(decodeKeybindPreferences({ defaultsVersion: 1, 'tool.select': 'alt+s' }).bindings['tool.select']).toBe('alt+s');
  const deliberate = decodeKeybindPreferences({ defaultsVersion: 2, 'tool.select': 'v' }).bindings;
  expect(deliberate['tool.select']).toBe('v');
  expect(deliberate['player.preview']).toBe('');
});
