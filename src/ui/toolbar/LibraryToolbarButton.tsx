import { BookOpen } from "lucide-react";
import { TouchTooltip } from "./TouchTooltip";

type LibraryToolbarButtonProps = {
  active?: boolean;
  onOpenLibrary: () => void;
};

export function LibraryToolbarButton({
  active = false,
  onOpenLibrary
}: LibraryToolbarButtonProps) {
  return (
    <TouchTooltip label="Open asset library.">
      <button
        aria-label="Library"
        aria-expanded={active}
        aria-haspopup="dialog"
        className={`flex h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-full border px-2 text-sm font-medium shadow-sm transition lg:h-auto lg:min-w-0 lg:px-3 lg:py-1.5 ${
          active
            ? "border-canvas-ink bg-canvas-ink text-canvas-on-ink"
            : "border-canvas-line bg-canvas-surface text-canvas-ink hover:bg-canvas"
        }`}
        onClick={onOpenLibrary}
        title="Open asset library."
        type="button"
      >
        <BookOpen aria-hidden="true" className="h-5 w-5 shrink-0" />
        <span className="hidden lg:inline">Library</span>
      </button>
    </TouchTooltip>
  );
}
