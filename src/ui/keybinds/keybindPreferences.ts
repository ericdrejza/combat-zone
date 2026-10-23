import { DEFAULT_KEYBINDS, KEYBIND_DEFINITIONS, bindingsConflict, isKeybind, type KeybindMap } from './keybindDefinitions';

export const KEYBIND_DEFAULTS_VERSION = 1;
const legacyDefaults = { 'actor.rename': 'r', 'tool.ruler': 'd', 'tool.annotation': 'n' } as const;
const defaults = () => ({ bindings: { ...DEFAULT_KEYBINDS }, ctrlWheelZoomEnabled: true });

/** Legacy records saved defaults as overrides; migrate those before resolving conflicts. */
export function decodeKeybindPreferences(value: unknown): { bindings: KeybindMap; ctrlWheelZoomEnabled: boolean } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return defaults();
  const stored = { ...value } as Record<string, unknown>;
  const version = stored.defaultsVersion;
  if (version !== undefined && version !== KEYBIND_DEFAULTS_VERSION) return defaults();
  for (const { editable, id } of KEYBIND_DEFINITIONS) {
    if (editable && stored[id] !== undefined && !isKeybind(stored[id])) return defaults();
  }
  if (version === undefined) {
    for (const [id, binding] of Object.entries(legacyDefaults)) {
      // Omission lets the current default participate below customized bindings.
      if (stored[id] === binding) delete stored[id];
    }
  }
  // Stored defaults are inherited, never higher priority than a real customization.
  for (const { editable, id } of KEYBIND_DEFINITIONS) {
    if (editable && stored[id] === DEFAULT_KEYBINDS[id]) delete stored[id];
  }
  const next = { ...DEFAULT_KEYBINDS };
  for (const { editable, id } of KEYBIND_DEFINITIONS) {
    if (editable && typeof stored[id] === 'string') next[id] = stored[id];
  }
  const assigned = KEYBIND_DEFINITIONS.filter(d => !d.editable).map(d => next[d.id]);
  const ordered = KEYBIND_DEFINITIONS.filter(d => d.editable).sort((a, b) => Number(typeof stored[b.id] === 'string') - Number(typeof stored[a.id] === 'string'));
  for (const { id } of ordered) {
    if (assigned.some(binding => bindingsConflict(binding, next[id]))) next[id] = '';
    if (next[id]) assigned.push(next[id]);
  }
  return { bindings: next, ctrlWheelZoomEnabled: typeof stored.ctrlWheelZoomEnabled === 'boolean' ? stored.ctrlWheelZoomEnabled : true };
}

/** A revision distinguishes intentional new overrides from the old default letters. */
export function encodeKeybindPreferences(bindings: KeybindMap, ctrlWheelZoomEnabled: boolean) {
  return {
    ...Object.fromEntries(KEYBIND_DEFINITIONS.filter(d => d.editable && bindings[d.id] !== DEFAULT_KEYBINDS[d.id]).map(({ id }) => [id, bindings[id]])),
    ctrlWheelZoomEnabled,
    defaultsVersion: KEYBIND_DEFAULTS_VERSION
  };
}
