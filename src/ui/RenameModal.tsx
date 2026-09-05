import { useEffect, useRef, useState } from "react";

type RenameModalProps = {
  ariaLabel: string;
  initialName?: string;
  inputLabel: string;
  onClose: () => void;
  onRename: (name: string) => void;
  submitLabel?: string;
  title: string;
};

/** Shared rename dialog used wherever the application asks for a new name. */
export function RenameModal({
  ariaLabel,
  initialName = "",
  inputLabel,
  onClose,
  onRename,
  submitLabel = "Rename",
  title
}: RenameModalProps) {
  const [name, setName] = useState(initialName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  function submitRename() {
    const nextName = name.trim();
    if (nextName) onRename(nextName);
    onClose();
  }

  return (
    <div
      aria-label={ariaLabel}
      aria-modal="true"
      className="viewport-overlay z-[70] flex items-center justify-center overflow-y-auto bg-black/30 p-4"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
        } else if (event.key === "Enter") {
          event.preventDefault();
          submitRename();
        }
      }}
      role="dialog"
    >
      <form
        className="w-[min(22rem,calc(100vw-2rem))] space-y-4 rounded-2xl border border-canvas-line bg-canvas-panel p-5 shadow-2xl"
        onSubmit={(event) => {
          event.preventDefault();
          submitRename();
        }}
      >
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        <label className="block space-y-1 text-sm font-medium">
          Name
          <input
            ref={inputRef}
            aria-label={inputLabel}
            className="w-full rounded-xl border border-canvas-line bg-white px-3 py-2 font-normal outline-none focus:border-canvas-ink"
            onChange={(event) => setName(event.target.value)}
            placeholder="Name"
            value={name}
          />
        </label>
        <div className="flex justify-end gap-2">
          <button
            className="rounded-xl border border-canvas-line bg-white px-4 py-2 text-sm font-medium transition hover:bg-canvas"
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-xl bg-canvas-ink px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
            type="submit"
          >
            {submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
