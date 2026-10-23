import { FIXED_SHORTCUT_REFERENCES, KEYBIND_DEFINITIONS } from "@ui/keybinds";

/** Keep display grouping separate from shortcut dispatch and conflict priority. */
function groupShortcuts<T extends { group: string; label: string }>(shortcuts: readonly T[]) {
  const groups = new Map<string, T[]>();
  for (const shortcut of shortcuts) {
    const entries = groups.get(shortcut.group) ?? [];
    entries.push(shortcut);
    groups.set(shortcut.group, entries);
  }
  return [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([title, entries]) => ({
    title, entries: entries.sort((a, b) => a.label.localeCompare(b.label))
  }));
}

export const CUSTOMIZABLE_SHORTCUT_GROUPS = groupShortcuts(
  KEYBIND_DEFINITIONS.filter(({ editable, id }) => editable && !id.startsWith("viewport.pan"))
);
export const FIXED_SHORTCUT_GROUPS = groupShortcuts(FIXED_SHORTCUT_REFERENCES);
