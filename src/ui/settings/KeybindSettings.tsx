import { ResetSettingsButton } from "./ResetSettingsButton";
import { TouchTooltip } from "@ui/toolbar/TouchTooltip";
import { SettingsCategory, SettingsSection, SettingsRow, SETTINGS_BUTTON } from "./SettingsLayout";
import { X } from "lucide-react";
import { type KeyboardEvent, useState } from "react";
import { formatKeybind, FIXED_SHORTCUT_REFERENCES, KEYBIND_DEFINITIONS, keybindFromEvent, useKeybinds, type KeybindActionId, type KeybindMap } from "@ui/keybinds";
import { ConfirmStatusDialog } from "@ui/panels/status_panel/StatusDialog";

const buttonClass = SETTINGS_BUTTON;
const directions = ["Up", "Down", "Left", "Right"] as const;

/** Assignments and presets share an atomic, explicit conflict override. */
export function KeybindSettings() {
  const { bindings, resetBindings, applyBindings } = useKeybinds();
  const [recording, setRecording] = useState<KeybindActionId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ updates: Partial<KeybindMap>; conflicts: KeybindActionId[] } | null>(null);

  function assign(updates: Partial<KeybindMap>) {
    const conflicts = applyBindings(updates);
    if (conflicts.length) {
      if (conflicts.some((id) => !KEYBIND_DEFINITIONS.find((d) => d.id === id)?.editable)) {
        setError("This shortcut is reserved for a read-only action.");
      } else setPending({ updates, conflicts });
      return;
    }
    setRecording(null); setError(null);
  }
  function capture(event: KeyboardEvent, id: KeybindActionId) {
    if (recording !== id) return;
    event.preventDefault(); event.stopPropagation();
    if (event.key === "Escape") { setRecording(null); setError(null); return; }
    if (event.key === "Backspace" || event.key === "Delete") { assign({ [id]: "" }); return; }
    let binding = keybindFromEvent(event.nativeEvent);
    if (!binding) { setError("Choose a letter, number, arrow, plus, or minus key, optionally with modifiers."); return; }
    if (event.shiftKey && binding.endsWith("plus")) binding = binding.replace(/plus$/, "shift+plus");
    assign({ [id]: binding });
  }
  function control(id: KeybindActionId, label: string, compact = false) {
    return <div className="flex min-w-0 items-center gap-1">
      <button aria-label={`Change ${label} keybind`} title={formatKeybind(bindings[id])} className={`${buttonClass} min-w-0 flex-1 truncate font-mono ${recording === id ? "bg-canvas text-canvas-ink" : "bg-canvas-surface"}`} onClick={() => { setRecording(id); setError(null); }} onKeyDown={(event) => capture(event, id)} type="button">{recording === id ? compact ? "Key…" : "Press key…" : compact && !bindings[id] ? "—" : formatKeybind(bindings[id])}</button>
      {!compact ? <TouchTooltip label={`Clear ${label} keybind`}><button aria-label={`Clear ${label} keybind`} title="clear keybind" disabled={!bindings[id]} className={`${buttonClass} shrink-0`} onClick={() => assign({ [id]: "" })} type="button"><X aria-hidden="true" className="h-3 w-3" /></button></TouchTooltip> : null}
    </div>;
  }
  function preset(keys: string[]) {
    assign(Object.fromEntries(directions.map((direction, index) => [`viewport.pan${direction}`, keys[index]])));
  }
  return <SettingsCategory title="Keybinds" description="Choose shortcuts or clear an assignment. While recording, Backspace clears it. Conflicting shortcuts require an override."
    actions={<ResetSettingsButton category="Keybinds" onReset={() => { resetBindings(); setRecording(null); setError(null); setPending(null); }} />}>
    {error ? <p role="alert" className="mt-3 text-sm text-red-600">{error}</p> : null}
    <SettingsSection title="Viewport panning">
      <div className="grid min-w-0 grid-cols-4 gap-1 sm:gap-3">{directions.map((direction) => <div className="min-w-0" key={direction}><p className="mb-1 text-center text-xs">{direction}</p>{control(`viewport.pan${direction}`, `Pan ${direction.toLowerCase()}`, true)}</div>)}</div>
      <div className="mt-3 flex flex-wrap items-center gap-2"><span className="text-xs text-canvas-muted">Quick select</span><button className={buttonClass} onClick={() => preset(["w", "s", "a", "d"])} type="button">WASD</button><button className={buttonClass} onClick={() => preset(["arrowup", "arrowdown", "arrowleft", "arrowright"])} type="button">Arrow keys</button><button className={buttonClass} onClick={() => preset(["", "", "", ""])} type="button">Clear pan</button></div>
    </SettingsSection>
    <SettingsSection title="Customizable shortcuts">
    <div className="divide-y divide-canvas-line">{KEYBIND_DEFINITIONS.filter(({ editable, id }) => editable && !id.startsWith("viewport.pan")).map(({ id, label }) => <SettingsRow label={label} key={id}>{control(id, label)}</SettingsRow>)}</div></SettingsSection>
    <SettingsSection title="Fixed shortcuts">
    <div className="divide-y divide-canvas-line">{FIXED_SHORTCUT_REFERENCES.map(({ binding, label }) => <SettingsRow label={label} key={`${binding}-${label}`}><span aria-label={`${label} keybind`} className="font-mono text-sm">{binding}</span></SettingsRow>)}</div></SettingsSection>
    {pending ? <ConfirmStatusDialog title="Override conflicting keybinds?" confirmLabel="Continue" onClose={() => setPending(null)} onConfirm={() => { const conflicts = applyBindings(pending.updates, true); if (conflicts.length) setError("The assignment could not be applied."); else { setRecording(null); setError(null); } setPending(null); }}><p>These actions will become unassigned:</p><ul className="mt-2 list-disc pl-5">{pending.conflicts.map((id) => <li key={id}>{KEYBIND_DEFINITIONS.find((d) => d.id === id)?.label}</li>)}</ul></ConfirmStatusDialog> : null}
  </SettingsCategory>;
}
