import { RotateCcw, X } from "lucide-react";
import { type KeyboardEvent, useState } from "react";
import { formatKeybind, FIXED_SHORTCUT_REFERENCES, KEYBIND_DEFINITIONS, keybindFromEvent, useKeybinds, type KeybindActionId, type KeybindMap } from "@ui/keybinds";
import { ConfirmStatusDialog } from "@ui/panels/status_panel/StatusDialog";

const buttonClass = "rounded-lg border border-canvas-line px-2 py-2 text-xs enabled:hover:bg-canvas focus-visible:ring-2 focus-visible:ring-canvas-ink disabled:cursor-not-allowed disabled:opacity-40";
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
      {!compact ? <button aria-label={`Clear ${label} keybind`} title="clear keybind" disabled={!bindings[id]} className={`${buttonClass} shrink-0`} onClick={() => assign({ [id]: "" })} type="button"><X aria-hidden="true" className="h-3 w-3" /></button> : null}
    </div>;
  }
  function preset(keys: string[]) {
    assign(Object.fromEntries(directions.map((direction, index) => [`viewport.pan${direction}`, keys[index]])));
  }
  return <section aria-labelledby="settings-keybinds-heading" className="min-w-0 p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="font-display text-lg font-semibold" id="settings-keybinds-heading">Keybinds</h3><p className="mt-1 text-sm text-canvas-muted">Choose shortcuts or clear an assignment. While recording, Backspace clears it. Conflicting shortcuts require an override.</p></div>
      <button className={`${buttonClass} flex items-center gap-2`} onClick={() => { resetBindings(); setRecording(null); setError(null); setPending(null); }} type="button"><RotateCcw aria-hidden="true" className="h-4 w-4" />Reset defaults</button>
    </div>
    {error ? <p role="alert" className="mt-3 text-sm text-red-600">{error}</p> : null}
    <fieldset className="mt-5 rounded-2xl border border-canvas-line bg-canvas-surface p-3">
      <legend className="px-1 text-sm font-semibold">Pan viewport</legend>
      <div className="grid min-w-0 grid-cols-4 gap-1 sm:gap-3">{directions.map((direction) => <div className="min-w-0" key={direction}><p className="mb-1 text-center text-xs">{direction}</p>{control(`viewport.pan${direction}`, `Pan ${direction.toLowerCase()}`, true)}</div>)}</div>
      <div className="mt-3 flex flex-wrap items-center gap-2"><span className="text-xs text-canvas-muted">Quick select</span><button className={buttonClass} onClick={() => preset(["w", "s", "a", "d"])} type="button">WASD</button><button className={buttonClass} onClick={() => preset(["arrowup", "arrowdown", "arrowleft", "arrowright"])} type="button">Arrow keys</button><button className={buttonClass} onClick={() => preset(["", "", "", ""])} type="button">Clear pan</button></div>
    </fieldset>
    <h4 className="mt-5 text-sm font-semibold">Customizable</h4>
    <div className="mt-2 divide-y divide-canvas-line rounded-2xl border border-canvas-line bg-canvas-surface">{KEYBIND_DEFINITIONS.filter(({ editable, id }) => editable && !id.startsWith("viewport.pan")).map(({ id, label }) => <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-3" key={id}><span className="text-sm font-medium">{label}</span>{control(id, label)}</div>)}</div>
    <h4 className="mt-5 text-sm font-semibold">Read-only shortcuts</h4>
    <div className="mt-2 divide-y divide-canvas-line rounded-2xl border border-canvas-line bg-canvas-surface">{FIXED_SHORTCUT_REFERENCES.map(({ binding, label }) => <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-3" key={`${binding}-${label}`}><span className="text-sm">{label}</span><span aria-label={`${label} keybind`} className="font-mono text-xs">{binding}</span></div>)}</div>
    {pending ? <ConfirmStatusDialog title="Override conflicting keybinds?" confirmLabel="Continue" onClose={() => setPending(null)} onConfirm={() => { const conflicts = applyBindings(pending.updates, true); if (conflicts.length) setError("The assignment could not be applied."); else { setRecording(null); setError(null); } setPending(null); }}><p>These actions will become unassigned:</p><ul className="mt-2 list-disc pl-5">{pending.conflicts.map((id) => <li key={id}>{KEYBIND_DEFINITIONS.find((d) => d.id === id)?.label}</li>)}</ul></ConfirmStatusDialog> : null}
  </section>;
}
