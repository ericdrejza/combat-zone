type UnsavedDraftDialogProps = {
  onCancel: () => void;
  onDiscard: () => void;
  onSave: () => void;
};

export function UnsavedDraftDialog({
  onCancel,
  onDiscard,
  onSave
}: UnsavedDraftDialogProps) {
  return (
    <div
      aria-label="Save encounter draft"
      aria-modal="true"
      className="fixed inset-0 z-[75] flex items-center justify-center bg-black/40 p-6"
      role="dialog"
    >
      <div className="w-[min(30rem,92vw)] rounded-3xl border border-canvas-line bg-white p-5 shadow-2xl">
        <h2 className="font-display text-xl font-semibold">Save this encounter?</h2>
        <p className="mt-2 text-sm text-canvas-muted">
          This encounter has not been saved to the Encounter Library.
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button className="rounded-xl border border-canvas-line px-4 py-2 text-sm" onClick={onCancel} type="button">
            Cancel
          </button>
          <button className="rounded-xl border border-red-300 px-4 py-2 text-sm text-red-700" onClick={onDiscard} type="button">
            Discard
          </button>
          <button className="rounded-xl bg-canvas-ink px-4 py-2 text-sm font-semibold text-white" onClick={onSave} type="button">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
