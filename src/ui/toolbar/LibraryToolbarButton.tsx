import { BookOpen } from "lucide-react";
import { TouchTooltip } from "./TouchTooltip";

type LibraryToolbarButtonProps = {
  onOpenLibrary: () => void;
};

export function LibraryToolbarButton({
  onOpenLibrary
}: LibraryToolbarButtonProps) {
  return (
    <TouchTooltip label="Open asset library.">
      <button
        aria-label="Library"
        className="flex h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-full border border-canvas-line bg-white px-2 text-sm font-medium text-canvas-ink shadow-sm transition hover:bg-canvas lg:h-auto lg:min-w-0 lg:px-3 lg:py-1.5"
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
