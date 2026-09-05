import { RotateCcw } from "lucide-react";
import { type KeyboardEvent, useState } from "react";

import {
  formatKeybind,
  FIXED_SHORTCUT_REFERENCES,
  KEYBIND_DEFINITIONS,
  keybindFromEvent,
  useKeybinds,
  type KeybindActionId
} from "@ui/keybinds";

export function KeybindSettings() {
  const { bindings, resetBindings, setBinding } = useKeybinds();
  const [recording, setRecording] = useState<KeybindActionId | null>(null);
  const [error, setError] = useState<string | null>(null);

  function captureBinding(event: KeyboardEvent, actionId: KeybindActionId) {
    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Escape") {
      setRecording(null);
      setError(null);
      return;
    }

    const binding = keybindFromEvent(event.nativeEvent);
    if (!binding || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
      setError("Choose one unmodified letter from A through Z.");
      return;
    }
    const conflictId = setBinding(actionId, binding);
    if (conflictId) {
      const conflict = KEYBIND_DEFINITIONS.find(({ id }) => id === conflictId);
      setError(`${formatKeybind(binding)} is already assigned to ${conflict?.label ?? "another action"}.`);
      return;
    }
    setRecording(null);
    setError(null);
  }

  return (
    <section aria-labelledby="settings-keybinds-heading" className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-display text-lg font-semibold" id="settings-keybinds-heading">Keybinds</h3>
          <p className="mt-1 text-sm text-canvas-muted">Single-letter shortcuts can be reassigned. Standard combinations are documented and read-only.</p>
        </div>
        <button className="flex shrink-0 items-center gap-2 rounded-xl border border-canvas-line bg-white px-3 py-2 text-sm font-medium transition hover:bg-canvas" onClick={() => { resetBindings(); setError(null); setRecording(null); }} type="button">
          <RotateCcw aria-hidden="true" className="h-4 w-4" />
          Reset defaults
        </button>
      </div>
      {error ? <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{error}</p> : null}
      <h4 className="mt-5 text-sm font-semibold">Customizable</h4>
      <div className="mt-2 divide-y divide-canvas-line rounded-2xl border border-canvas-line bg-white">
        {KEYBIND_DEFINITIONS.filter(({ editable }) => editable).map(({ id, label }) => (
          <div className="flex items-center justify-between gap-4 px-4 py-3" key={id}>
            <span className="text-sm font-medium">{label}</span>
            <button
              aria-label={`Change ${label} keybind`}
              className={`min-w-28 rounded-lg border px-3 py-1.5 text-center font-mono text-xs font-semibold ${recording === id ? "border-canvas-ink bg-canvas text-canvas-ink" : "border-canvas-line bg-white text-canvas-muted"}`}
              onClick={() => { setRecording(id); setError(null); }}
              onKeyDown={(event) => captureBinding(event, id)}
              type="button"
            >
              {recording === id ? "Press key…" : formatKeybind(bindings[id])}
            </button>
          </div>
        ))}
      </div>
      <h4 className="mt-5 text-sm font-semibold">Read-only shortcuts</h4>
      <div className="mt-2 divide-y divide-canvas-line rounded-2xl border border-canvas-line bg-white">
        {FIXED_SHORTCUT_REFERENCES.map(({ binding, label }) => (
          <div className="flex items-center justify-between gap-4 px-4 py-3" key={`${binding}-${label}`}>
            <span className="text-sm font-medium">{label}</span>
            <span aria-label={`${label} keybind`} className="min-w-28 rounded-lg border border-canvas-line bg-canvas px-3 py-1.5 text-center font-mono text-xs font-semibold text-canvas-muted">{binding}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
