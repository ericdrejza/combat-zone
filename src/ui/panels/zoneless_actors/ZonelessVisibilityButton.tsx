import { Slash, UsersRound } from "lucide-react";
import { TouchTooltip } from "@ui/toolbar/TouchTooltip";

type ZonelessVisibilityButtonProps = {
  visible: boolean;
  onToggle: () => void;
};

export function ZonelessVisibilityButton({ visible, onToggle }: ZonelessVisibilityButtonProps) {
  const label = visible ? "Hide Zoneless panel" : "Show Zoneless panel";
  return (
    <TouchTooltip label={label}>
      <button
        type="button"
        title={label}
        aria-label={label}
        aria-pressed={visible}
        onClick={onToggle}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-canvas-line bg-canvas-panel text-canvas-muted shadow-sm hover:bg-canvas-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canvas-ink"
      >
        <span aria-hidden="true" className="relative h-5 w-5">
          <UsersRound className="h-5 w-5" />
          {visible ? <Slash className="absolute inset-0 h-5 w-5 -scale-x-100" /> : null}
        </span>
      </button>
    </TouchTooltip>
  );
}
