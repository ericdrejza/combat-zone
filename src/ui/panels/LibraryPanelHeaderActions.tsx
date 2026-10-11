import { BookOpen, Grid2X2, List } from "lucide-react";

import { TouchTooltip } from "@ui/toolbar/TouchTooltip";
import type { LibraryViewMode } from "./LibraryPanel";

type ViewToggleProps = { onToggle: () => void; viewMode: LibraryViewMode };
type Props = ViewToggleProps & { libraryOpen: boolean; onOpenLibrary: () => void };

/** Shares the same modal launcher and view controls across docked and compact panels. */
export function LibraryPanelHeaderActions({ libraryOpen, onOpenLibrary, ...view }: Props) {
  return <div aria-label="Library panel controls" className="flex items-center gap-2" role="group">
    <TouchTooltip label="Open asset library.">
      <button aria-label="Open asset library" aria-expanded={libraryOpen} aria-haspopup="dialog" className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border enabled:hover:ring-2 enabled:hover:ring-canvas-muted focus-visible:ring-2 focus-visible:ring-canvas-ink ${libraryOpen ? "border-canvas-ink bg-canvas-ink text-canvas-on-ink" : "border-canvas-line bg-canvas-surface text-canvas-muted enabled:hover:bg-canvas"}`} onClick={onOpenLibrary} title="Open asset library." type="button">
        <BookOpen aria-hidden="true" className="h-4 w-4" />
      </button>
    </TouchTooltip>
    <LibraryPanelViewToggle {...view} />
  </div>;
}

export function LibraryPanelViewToggle({ onToggle, viewMode }: ViewToggleProps) {
  const showingGrid = viewMode === "grid";
  const label = showingGrid ? "Switch Library to list view" : "Switch Library to grid view";
  return <TouchTooltip label={label}>
    <button aria-label={label} aria-pressed={showingGrid} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-canvas-line bg-canvas-surface text-canvas-muted enabled:hover:bg-canvas enabled:hover:ring-2 enabled:hover:ring-canvas-muted focus-visible:ring-2 focus-visible:ring-canvas-ink" onClick={onToggle} title={label} type="button">
      {showingGrid ? <List aria-hidden="true" className="h-4 w-4" /> : <Grid2X2 aria-hidden="true" className="h-4 w-4" />}
    </button>
  </TouchTooltip>;
}
