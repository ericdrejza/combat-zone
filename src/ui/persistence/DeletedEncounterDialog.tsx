type DeletedEncounterDialogProps = {
  onCreate: () => void;
  onLoad: () => void;
};

export function DeletedEncounterDialog({
  onCreate,
  onLoad
}: DeletedEncounterDialogProps) {
  return (
    <div
      aria-label="Choose an encounter"
      aria-modal="true"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-6"
      role="dialog"
    >
      <div className="w-[min(32rem,92vw)] rounded-3xl border border-canvas-line bg-white p-5 shadow-2xl">
        <h2 className="font-display text-xl font-semibold">
          You've just deleted your encounter. What would you like to do?
        </h2>
        <div className="mt-5 flex justify-end gap-2">
          <button className="rounded-xl border border-canvas-line px-4 py-2 text-sm font-medium" onClick={onLoad} type="button">
            Load encounter
          </button>
          <button className="rounded-xl bg-canvas-ink px-4 py-2 text-sm font-semibold text-white" onClick={onCreate} type="button">
            Create new encounter
          </button>
        </div>
      </div>
    </div>
  );
}
