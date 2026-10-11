import { TOOL_DEFINITIONS_BY_ID } from "@interaction/tools/toolRegistry";

export const KEYBIND_DEFINITIONS = [
  { id: "actor.moveUp", label: "Move actors up", defaultBinding: "arrowup", editable: true },
  { id: "actor.moveDown", label: "Move actors down", defaultBinding: "arrowdown", editable: true },
  { id: "actor.moveLeft", label: "Move actors left", defaultBinding: "arrowleft", editable: true },
  { id: "actor.moveRight", label: "Move actors right", defaultBinding: "arrowright", editable: true },
  { id: "actor.sizeDecrease", label: "Decrease actor size", defaultBinding: "shift+minus", editable: true },
  { id: "actor.sizeIncrease", label: "Increase actor size", defaultBinding: "shift+plus", editable: true },
  { id: "actor.healDamage", label: "Heal or damage actors", defaultBinding: "h", editable: true },
  { id: "library.open", label: "Open Library", defaultBinding: "l", editable: true },
  { id: "audio.toggle", label: "Play/Pause all audio", defaultBinding: "p", editable: true },
  { id: "viewport.panUp", label: "Pan up", defaultBinding: "", editable: true },
  { id: "viewport.panDown", label: "Pan down", defaultBinding: "", editable: true },
  { id: "viewport.panLeft", label: "Pan left", defaultBinding: "", editable: true },
  { id: "viewport.panRight", label: "Pan right", defaultBinding: "", editable: true },
  { id: "viewport.zoomOut", label: "Zoom out", defaultBinding: "minus", editable: true },
  { id: "viewport.zoomIn", label: "Zoom in", defaultBinding: "plus", editable: true },
  { id: "viewport.fitWidth", label: "Zoom to fit width", defaultBinding: "ctrl+arrowleft", editable: true },
  { id: "viewport.fitHeight", label: "Zoom to fit height", defaultBinding: "ctrl+arrowright", editable: true },
  { id: "viewport.fit", label: "Zoom to fit", defaultBinding: "ctrl+arrowup", editable: true },
  { id: "viewport.reset", label: "Reset zoom", defaultBinding: "ctrl+arrowdown", editable: true },
  { id: "initiative.toggle", label: "Toggle Initiative popout", defaultBinding: "i", editable: true },
  { id: "actor.copy", label: "Copy selected actor", defaultBinding: "mod+c", editable: false },
  { id: "actor.paste", label: "Paste copied actor", defaultBinding: "mod+v", editable: false },
  { id: "actor.rename", label: "Rename selected actor", defaultBinding: "r", editable: true },
  { id: "actor.showFactionOutlines", label: "Show actor faction outlines and names", defaultBinding: "o", editable: true },
  { id: "selection.selectAll", label: "Select all", defaultBinding: "mod+a", editable: false },
  { id: "tool.actor", label: "Activate Actor tool", defaultBinding: TOOL_DEFINITIONS_BY_ID.actor.contract.keyboardShortcut, editable: true },
  { id: "tool.audio", label: "Activate Audio tool", defaultBinding: TOOL_DEFINITIONS_BY_ID.audio.contract.keyboardShortcut, editable: true },
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

/** Turns browser punctuation and modifier variants into durable, displayable chords. */
export function keybindFromEvent(event: KeyboardEvent): string | null {
  let key = event.key.toLowerCase();
  if (["alt", "control", "meta", "shift"].includes(key)) return null;
  if (key === "+" || key === "=" || event.code === "NumpadAdd") key = "plus";
  if (key === "-" || key === "_" || event.code === "NumpadSubtract") key = "minus";
  if (!/^[a-z0-9]$/.test(key) && !["arrowup", "arrowdown", "arrowleft", "arrowright", "plus", "minus"].includes(key)) return null;
  // Plus intrinsically requires Shift on many keyboards. Equal also works for zoom.
  const shifted = event.shiftKey && key !== "plus";
  return [event.ctrlKey ? "ctrl" : null, event.metaKey ? "meta" : null,
    event.altKey ? "alt" : null, shifted ? "shift" : null, key].filter(Boolean).join("+");
}

export function isKeybind(binding: unknown): binding is string {
  return typeof binding === "string" && (binding === "" || /^(?:(?:mod|ctrl|meta|alt|shift)\+)*(?:[a-z0-9]|arrowup|arrowdown|arrowleft|arrowright|plus|minus)$/.test(binding));
}

export function bindingsConflict(a: string, b: string): boolean {
  if (!a || !b) return false;
  const variants = (value: string) => value.includes("mod+")
    ? [value.replace("mod+", "ctrl+"), value.replace("mod+", "meta+")]
    : [value];
  return variants(a).some((value) => variants(b).includes(value));
}

/** Matching separates physical Shift+Plus from the ordinary plus zoom shortcut. */
export function matchesKeybind(event: KeyboardEvent, binding: string): boolean {
  if (!binding) return false;
  let chord = keybindFromEvent(event);
  if (!chord) return false;
  if (binding.includes("mod+")) chord = chord.replace(/^(ctrl|meta)\+/, "mod+");
  if (binding.includes("shift+plus") && event.shiftKey && chord.endsWith("plus")) {
    chord = chord.replace(/plus$/, "shift+plus");
  }
  return chord === binding;
}

export function formatKeybind(binding: string): string {
  if (!binding) return "Unassigned";
  const labels: Record<string, string> = { mod: "Ctrl/Cmd", ctrl: "Ctrl", meta: "Cmd", plus: "+", minus: "-", arrowup: "↑", arrowdown: "↓", arrowleft: "←", arrowright: "→" };
  return binding.split("+").map((part) => labels[part] ?? part[0].toUpperCase() + part.slice(1)).join(" + ");
}
