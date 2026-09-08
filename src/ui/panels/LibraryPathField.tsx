import type { ReactNode } from "react";

type LibraryPathFieldProps = {
  actions?: ReactNode;
  onOpen: () => void;
  value: string;
};

/** A library reference is read-only data, but remains direct navigation. */
export function LibraryPathField({
  actions,
  onOpen,
  value
}: LibraryPathFieldProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-canvas-ink">Library Path</span>
        {actions}
      </div>
      <input
        aria-label="Library Path"
        className="w-full cursor-pointer rounded-xl border border-canvas-line bg-canvas px-3 py-2 text-canvas-ink"
        onClick={onOpen}
        readOnly
        type="text"
        value={value}
      />
    </div>
  );
}
