import { TOOL_DEFINITIONS_BY_ID } from "@interaction/tools/toolRegistry";

export const KEYBIND_DEFINITIONS = [
  { id: "actor.copy", label: "Copy selected actor", defaultBinding: "mod+c", editable: false },
  { id: "actor.paste", label: "Paste copied actor", defaultBinding: "mod+v", editable: false },
  { id: "actor.rename", label: "Rename selected actor", defaultBinding: "r", editable: true },
  { id: "selection.selectAll", label: "Select all", defaultBinding: "mod+a", editable: false },
  { id: "tool.actor", label: "Activate Actor tool", defaultBinding: TOOL_DEFINITIONS_BY_ID.actor.contract.keyboardShortcut, editable: true },
  { id: "tool.annotation", label: "Activate Annotation tool", defaultBinding: TOOL_DEFINITIONS_BY_ID.annotation.contract.keyboardShortcut, editable: true },
  { id: "tool.background", label: "Activate Background tool", defaultBinding: TOOL_DEFINITIONS_BY_ID.background.contract.keyboardShortcut, editable: true },
  { id: "tool.edge", label: "Activate Edge tool", defaultBinding: TOOL_DEFINITIONS_BY_ID.edge.contract.keyboardShortcut, editable: true },
  { id: "tool.select", label: "Activate Select tool", defaultBinding: TOOL_DEFINITIONS_BY_ID.select.contract.keyboardShortcut, editable: true },
  { id: "tool.zone", label: "Activate Zone tool", defaultBinding: TOOL_DEFINITIONS_BY_ID.zone.contract.keyboardShortcut, editable: true },
  { id: "workspace.save", label: "Save encounter", defaultBinding: "mod+s", editable: false }
] as const;

export type KeybindActionId = (typeof KEYBIND_DEFINITIONS)[number]["id"];
export type KeybindMap = Record<KeybindActionId, string>;

export const DEFAULT_KEYBINDS = Object.fromEntries(
  KEYBIND_DEFINITIONS.map(({ defaultBinding, id }) => [id, defaultBinding])
) as KeybindMap;

export const FIXED_SHORTCUT_REFERENCES = [
  { binding: "Hold Alt", label: "Show actor faction outlines" },
  { binding: "Ctrl/Cmd + Left-click", label: "Toggle a canvas or initiative selection" },
  { binding: "Ctrl/Cmd + Left-drag", label: "Clone a zone or drag selected actors together" },
  { binding: "Ctrl/Cmd + A", label: "Select all" },
  { binding: "Ctrl/Cmd + C", label: "Copy selected actor" },
  { binding: "Ctrl/Cmd + S", label: "Save encounter" },
  { binding: "Ctrl/Cmd + V", label: "Paste copied actor" },
  { binding: "Shift + Left-click", label: "Toggle canvas selection or select an initiative range" },
  { binding: "Shift + Left-drag", label: "Box select or drag selected actors together" },
  { binding: "Shift + Tab", label: "Select previous zone" },
  { binding: "Shift + Wheel", label: "Scroll canvas horizontally" },
  { binding: "Tab", label: "Select next zone" }
] as const;

/** Turns a keyboard event into the portable chord persisted in preferences. */
export function keybindFromEvent(event: KeyboardEvent): string | null {
  const key = event.key.toLowerCase();
  if (["alt", "control", "meta", "shift"].includes(key)) return null;
  if (!/^[a-z]$/.test(key)) return null;

  return [
    event.ctrlKey || event.metaKey ? "mod" : null,
    event.altKey ? "alt" : null,
    event.shiftKey ? "shift" : null,
    key
  ].filter(Boolean).join("+");
}

/** Matches Ctrl on Windows/Linux and Command on macOS through one binding. */
export function matchesKeybind(event: KeyboardEvent, binding: string): boolean {
  return keybindFromEvent(event) === binding;
}

export function formatKeybind(binding: string): string {
  return binding
    .split("+")
    .map((part) => part === "mod" ? "Ctrl/Cmd" : part[0].toUpperCase() + part.slice(1))
    .join(" + ");
}
