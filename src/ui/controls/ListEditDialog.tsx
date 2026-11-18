import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { StatusDialog } from "@ui/panels/status_panel/StatusDialog";
import { OrderedEditorSelect, type OrderedEditorSelectProps } from "./OrderedEditorSelect";
import { DiscardConfigurableChanges } from "./DiscardConfigurableChanges";

type Props = {
  title: string; selection?: OrderedEditorSelectProps; children: ReactNode;
  onClose: () => void; onSave: () => void | Promise<void>; onDelete?: () => void;
  disabled?: boolean; saveDisabled?: boolean; cancelOnBackdrop?: boolean;
  dirtyCount?: number;
};
const button = "rounded-lg border px-3 py-2 focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-40";
/** Rollables, counters and clocks share selection, focus handling, and one consistent action row. */
export function ListEditDialog({ title, selection, children, onClose, onSave, onDelete, disabled = false, saveDisabled = false, cancelOnBackdrop = false, dirtyCount = 0 }: Props) {
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const [createFocusRequest, setCreateFocusRequest] = useState(0);
  // Field implementations identify their Name input without coupling this shell to entity-specific labels.
  useLayoutEffect(() => {
    if (createFocusRequest) form.current?.querySelector<HTMLInputElement>('[data-configurable-name]')?.focus();
  }, [createFocusRequest]);
  function requestClose(cancel = false) {
    if (dirtyCount > (cancel ? 1 : 0)) setConfirmDiscard(true);
    else onClose();
  }
  return <><StatusDialog title={title} onClose={() => requestClose()} cancelOnBackdrop={cancelOnBackdrop}>
    <form ref={form} className="space-y-3" onSubmit={event => { event.preventDefault(); if (!disabled && !saveDisabled) void onSave(); }}>
      {selection ? <><OrderedEditorSelect {...selection} onCreate={() => { selection.onCreate(); setCreateFocusRequest(value => value + 1); }} disabled={disabled || selection.disabled} /><hr className="border-canvas-line" /></> : null}
      <fieldset disabled={disabled} className="min-w-0 space-y-3">{children}</fieldset>
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        {onDelete ? <button type="button" disabled={disabled} onClick={onDelete}
          className={`${button} border-red-200 bg-red-50 text-red-700 enabled:hover:bg-red-100 focus-visible:ring-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-500 dark:enabled:hover:bg-red-900`}>Delete</button> : null}
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={() => requestClose(true)} className={`${button} border-canvas-line enabled:hover:bg-canvas-surface focus-visible:ring-canvas-ink`}>Cancel</button>
          <button type="submit" disabled={disabled || saveDisabled} className={`${button} border-canvas-ink bg-canvas-ink text-canvas-on-ink enabled:hover:bg-canvas-ink/80 focus-visible:ring-canvas-ink disabled:border-canvas-line disabled:bg-canvas-surface disabled:text-canvas-muted`}>Save</button>
        </div>
      </div>
    </form>
  </StatusDialog>{confirmDiscard ? <DiscardConfigurableChanges onContinue={() => setConfirmDiscard(false)} onDiscard={onClose} /> : null}</>;
}
