type ImportTypeMismatchDialogProps = {
  expected: "encounter" | "workspace";
  onClose: () => void;
};

export function ImportTypeMismatchDialog({
  expected,
  onClose
}: ImportTypeMismatchDialogProps) {
  const actual = expected === "workspace" ? "encounter" : "workspace";
  const article = actual === "encounter" ? "an" : "a";
  const destination =
    expected === "workspace"
      ? "Import workspace from Settings instead."
      : "Import encounter from Library → Encounters → Add instead.";

  return (
    <div
      aria-label="Wrong import file type"
      aria-modal="true"
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-6"
      role="dialog"
    >
      <div className="w-[min(30rem,92vw)] rounded-3xl border border-canvas-line bg-white p-5 shadow-2xl">
        <h2 className="font-display text-xl font-semibold">Wrong import file</h2>
        <p className="mt-2 text-sm text-canvas-muted">
          You’re trying to import {article} {actual} file from the {expected} import
          action. {destination}
        </p>
        <div className="mt-5 flex justify-end">
          <button
            className="rounded-xl bg-canvas-ink px-4 py-2 text-sm font-semibold text-white"
            onClick={onClose}
            type="button"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
