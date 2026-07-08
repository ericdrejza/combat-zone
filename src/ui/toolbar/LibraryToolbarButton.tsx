import { BookOpen } from "lucide-react";

type LibraryToolbarButtonProps = {
  onOpenLibrary: () => void;
};

export function LibraryToolbarButton({
  onOpenLibrary
}: LibraryToolbarButtonProps) {
  return (
    <button
      aria-label="Library"
      className="inline-flex items-center gap-2 rounded-full border border-canvas-line bg-white px-3 py-1.5 text-sm font-medium text-canvas-ink shadow-sm transition hover:bg-canvas"
      onClick={onOpenLibrary}
      title="Open asset library."
      type="button"
    >
      <BookOpen aria-hidden="true" className="h-4 w-4" />
      Library
    </button>
  );
}
