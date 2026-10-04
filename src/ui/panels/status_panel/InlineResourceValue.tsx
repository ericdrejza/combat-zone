import { useEffect, useRef, useState } from "react";

/** Digit-only inline edits commit once on blur/Enter; Escape discards the draft. */
export function InlineResourceValue({ value, label, disabled, onSave }: {
  value: number;
  label: string;
  disabled: boolean;
  onSave: (value: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const input = useRef<HTMLInputElement>(null);
  const canceled = useRef(false);
  useEffect(() => {
    if (editing) { input.current?.focus(); input.current?.select(); }
  }, [editing]);
  function finish() {
    setEditing(false);
    if (canceled.current || disabled || !/^\d+$/.test(draft)) return;
    const next = Number(draft);
    if (Number.isSafeInteger(next) && next !== value) onSave(next);
  }
  if (!editing) return <button aria-label={label} title={disabled ? "Read-only encounter" : label} disabled={disabled} className="rounded px-1 underline decoration-dotted enabled:hover:bg-canvas-surface enabled:hover:decoration-solid focus-visible:ring-2 focus-visible:ring-canvas-ink disabled:cursor-not-allowed disabled:bg-canvas-surface disabled:text-canvas-muted disabled:opacity-40" onClick={() => { canceled.current = false; setDraft(String(value)); setEditing(true); }} type="button">{value}</button>;
  return <input aria-label={label} ref={input} type="text" inputMode="numeric" pattern="[0-9]*" className="min-w-0 rounded border border-canvas-line bg-canvas px-1 text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-canvas-ink" style={{ width: `${Math.max(2, draft.length + 1)}ch` }} value={draft} disabled={disabled} onChange={(event) => {
    if (/^\d*$/.test(event.currentTarget.value)) setDraft(event.currentTarget.value);
  }} onBlur={finish} onKeyDown={(event) => {
    event.stopPropagation();
    if (event.key === "Enter" || event.key === "Escape") {
      event.preventDefault();
      canceled.current = event.key === "Escape";
      event.currentTarget.blur();
    }
  }} />;
}
