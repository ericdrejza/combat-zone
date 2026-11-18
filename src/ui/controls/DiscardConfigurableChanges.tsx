import { StatusDialog } from "@ui/panels/status_panel/StatusDialog";

/** Escape returns to editing; only the explicitly focused discard action loses the draft. */
export function DiscardConfigurableChanges({ onContinue, onDiscard }: { onContinue: () => void; onDiscard: () => void }) {
  return <StatusDialog title="Unsaved changes" onClose={onContinue} cancelOnBackdrop>
    <p className="text-sm">You have unsaved changes. Discard them?</p>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
      <button type="button" onClick={onContinue} className="rounded-lg border border-canvas-line px-3 py-2 hover:bg-canvas-surface focus-visible:ring-2 focus-visible:ring-canvas-ink">Continue editing</button>
      <button type="button" data-dialog-initial-focus="true" onClick={onDiscard} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700 hover:bg-red-100 focus-visible:ring-2 focus-visible:ring-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-500 dark:hover:bg-red-900">Discard changes</button>
    </div>
  </StatusDialog>;
}
