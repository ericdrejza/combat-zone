import { Crosshair, Filter } from "lucide-react";

import { TouchTooltip } from "@ui/toolbar/TouchTooltip";

export function SoundboardSelectionControls({ highlight, filter, onToggleHighlight, onToggleFilter }: {
  highlight: boolean;
  filter: boolean;
  onToggleHighlight: () => void;
  onToggleFilter: () => void;
}) {
  const buttonClass = (active: boolean) => `flex h-8 w-8 shrink-0 items-center justify-center rounded-full border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canvas-ink ${active ? "border-canvas-ink bg-canvas-ink text-canvas-on-ink hover:ring-2 hover:ring-canvas-ink/40" : "border-canvas-line bg-canvas-surface text-canvas-muted hover:bg-canvas"}`;
  return <div className="flex shrink-0 items-center gap-1">
    <TouchTooltip label="Highlight audio groups used by selected entities"><button type="button" className={buttonClass(highlight)} aria-label="Highlight selected entities’ audio groups" aria-pressed={highlight} onClick={onToggleHighlight} title="Highlight audio groups used by selected entities">
      <Crosshair aria-hidden="true" className="h-4 w-4" />
    </button></TouchTooltip>
    <TouchTooltip label="Show only audio groups used by selected entities"><button type="button" className={buttonClass(filter)} aria-label="Filter to selected entities’ audio groups" aria-pressed={filter} onClick={onToggleFilter} title="Show only audio groups used by selected entities">
      <Filter aria-hidden="true" className="h-4 w-4" />
    </button></TouchTooltip>
  </div>;
}
