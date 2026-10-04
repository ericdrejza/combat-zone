import { useEffect, useState } from "react";

/** Controlled drafts follow committed state after undo, redo, or external reload. */
export function NotesEditor({ notes = "", disabled = false, onChange }: {
  notes?: string; disabled?: boolean; onChange: (notes: string) => void;
}) {
  const [draft, setDraft] = useState(notes);
  useEffect(() => setDraft(notes), [notes]);
  return <label className="block space-y-1">
    <span className="font-semibold text-canvas-ink">Notes</span>
    <textarea aria-label="Notes" className="w-full rounded-xl border border-canvas-line bg-canvas-surface px-3 py-2 enabled:hover:border-canvas-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-canvas-ink disabled:cursor-not-allowed disabled:text-canvas-muted disabled:opacity-40"
      disabled={disabled} value={draft} onChange={(event) => setDraft(event.currentTarget.value)}
      onBlur={() => { if (!disabled && draft !== notes) onChange(draft); }} rows={3} />
  </label>;
}
