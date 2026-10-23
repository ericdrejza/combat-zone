import { TOOL_DEFINITIONS_BY_ID } from "@interaction/tools/toolRegistry";

export const KEYBIND_DEFINITIONS = [
  { id: "history.undo", group: "History", label: "Undo encounter change", defaultBinding: "mod+z", editable: true },
  { id: "history.redo", group: "History", label: "Redo encounter change", defaultBinding: "mod+shift+z", editable: true },
  { id: "actor.moveUp", group: "Entities", label: "Move actors up", defaultBinding: "arrowup", editable: true },
  { id: "actor.moveDown", group: "Entities", label: "Move actors down", defaultBinding: "arrowdown", editable: true },
  { id: "actor.moveLeft", group: "Entities", label: "Move actors left", defaultBinding: "arrowleft", editable: true },
  { id: "actor.moveRight", group: "Entities", label: "Move actors right", defaultBinding: "arrowright", editable: true },
  { id: "actor.sizeDecrease", group: "Entities", label: "Decrease actor size", defaultBinding: "shift+minus", editable: true },
  { id: "actor.sizeIncrease", group: "Entities", label: "Increase actor size", defaultBinding: "shift+plus", editable: true },
  { id: "actor.healDamage", group: "Entities", label: "Heal or damage actors", defaultBinding: "h", editable: true },
  { id: "panels.toggle", group: "Panels", label: "Expand/collapse sidebars", defaultBinding: "q", editable: true },
  { id: "library.open", group: "Panels", label: "Open Library", defaultBinding: "l", editable: true },
  { id: "audio.toggle", group: "Audio", label: "Play/Pause all audio", defaultBinding: "p", editable: true },
  { id: "viewport.panUp", group: "Viewport", label: "Pan up", defaultBinding: "", editable: true },
  { id: "viewport.panDown", group: "Viewport", label: "Pan down", defaultBinding: "", editable: true },
  { id: "viewport.panLeft", group: "Viewport", label: "Pan left", defaultBinding: "", editable: true },
  { id: "viewport.panRight", group: "Viewport", label: "Pan right", defaultBinding: "", editable: true },
  { id: "viewport.zoomOut", group: "Viewport", label: "Zoom out", defaultBinding: "minus", editable: true },
  { id: "viewport.zoomIn", group: "Viewport", label: "Zoom in", defaultBinding: "plus", editable: true },
  { id: "viewport.fitWidth", group: "Viewport", label: "Zoom to fit width", defaultBinding: "ctrl+arrowleft", editable: true },
  { id: "viewport.fitHeight", group: "Viewport", label: "Zoom to fit height", defaultBinding: "ctrl+arrowright", editable: true },
  { id: "viewport.fit", group: "Viewport", label: "Zoom to fit", defaultBinding: "ctrl+arrowup", editable: true },
  { id: "viewport.reset", group: "Viewport", label: "Reset zoom", defaultBinding: "ctrl+arrowdown", editable: true },
  { id: "initiative.toggle", group: "Panels", label: "Toggle Initiative popout", defaultBinding: "i", editable: true },
  { id: "actor.copy", group: "Entities", label: "Copy selected actor", defaultBinding: "mod+c", editable: false },
  { id: "actor.paste", group: "Entities", label: "Paste copied actor", defaultBinding: "mod+v", editable: false },
  { id: "actor.rename", group: "Entities", label: "Rename selected actors, zones, or ruler artifacts", defaultBinding: "n", editable: true },
  { id: "actor.showFactionOutlines", group: "Entities", label: "Show actor faction outlines and names", defaultBinding: "o", editable: true },
  { id: "selection.selectAll", group: "Selection", label: "Select all", defaultBinding: "mod+a", editable: false },
  { id: "tool.ruler", group: "Tools", label: "Activate Ruler tool", defaultBinding: TOOL_DEFINITIONS_BY_ID.ruler.contract.keyboardShortcut, editable: true },
  { id: "tool.actor", group: "Tools", label: "Activate Actor tool", defaultBinding: TOOL_DEFINITIONS_BY_ID.actor.contract.keyboardShortcut, editable: true },
  { id: "tool.audio", group: "Tools", label: "Activate Audio tool", defaultBinding: TOOL_DEFINITIONS_BY_ID.audio.contract.keyboardShortcut, editable: true },
  { id: "tool.annotation", group: "Tools", label: "Activate Annotation tool", defaultBinding: TOOL_DEFINITIONS_BY_ID.annotation.contract.keyboardShortcut, editable: true },
  { id: "tool.background", group: "Tools", label: "Activate Background tool", defaultBinding: TOOL_DEFINITIONS_BY_ID.background.contract.keyboardShortcut, editable: true },
  { id: "tool.edge", group: "Tools", label: "Activate Edge tool", defaultBinding: TOOL_DEFINITIONS_BY_ID.edge.contract.keyboardShortcut, editable: true },
  { id: "tool.select", group: "Tools", label: "Activate Select tool", defaultBinding: TOOL_DEFINITIONS_BY_ID.select.contract.keyboardShortcut, editable: true },
  { id: "tool.zone", group: "Tools", label: "Activate Zone tool", defaultBinding: TOOL_DEFINITIONS_BY_ID.zone.contract.keyboardShortcut, editable: true },
  { id: "workspace.save", group: "Workspace", label: "Save encounter", defaultBinding: "mod+s", editable: false }
] as const;

export type KeybindActionId = (typeof KEYBIND_DEFINITIONS)[number]["id"];
export type KeybindMap = Record<KeybindActionId, string>;

export const DEFAULT_KEYBINDS = Object.fromEntries(
  KEYBIND_DEFINITIONS.map(({ defaultBinding, id }) => [id, defaultBinding])
) as KeybindMap;

export const FIXED_SHORTCUT_REFERENCES = [
  { group: "Selection and editing", binding: "Ctrl/Cmd + Left-click", label: "Toggle a canvas or initiative selection" },
  { group: "Selection and editing", binding: "Ctrl/Cmd + Left-drag", label: "Clone a zone or drag selected actors together" },
  { group: "Selection and editing", binding: "Ctrl/Cmd + A", label: "Select all" },
  { group: "Selection and editing", binding: "Ctrl/Cmd + C", label: "Copy selected actor" },
  { group: "Workspace", binding: "Ctrl/Cmd + S", label: "Save encounter" },
  { group: "Viewport", binding: "Ctrl + Wheel up/down", label: "Zoom in/out" },
  { group: "Selection and editing", binding: "Ctrl/Cmd + V", label: "Paste copied actor" },
  { group: "Selection and editing", binding: "Shift + Left-click", label: "Toggle canvas selection or select an initiative range" },
  { group: "Selection and editing", binding: "Shift + Left-drag", label: "Box select or drag selected actors together" },
  { group: "Selection and editing", binding: "Shift + Tab", label: "Select previous zone" },
  { group: "Viewport", binding: "Shift + Wheel", label: "Scroll canvas horizontally" },
  { group: "Ruler", binding: "Shift + Wheel", label: "Adjust cone angle in Ruler cone mode" },
  { group: "Ruler", binding: "1–5", label: "Choose ruler shape while Ruler is active" },
  { group: "Ruler", binding: "9", label: "Toggle actor movement distance while Ruler is active" },
  { group: "Ruler", binding: "0", label: "Clear rulers while Ruler is active" },
  { group: "Ruler", binding: "Space", label: "Lock ruler measurement; add a pivot during actor movement" },
  { group: "Selection and editing", binding: "Tab", label: "Select next zone" }
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
