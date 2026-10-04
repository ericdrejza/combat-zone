import type { LucideIcon } from "lucide-react";
import { TouchTooltip } from "@ui/toolbar/TouchTooltip";

/** Shared marker affordance for actor state and settings visibility. */
export function StatusMarkerToggle({ label, tooltip, Icon, pressed, disabled = false, onClick }: {
  label: string; tooltip: string; Icon: LucideIcon; pressed: boolean | "mixed"; disabled?: boolean; onClick: () => void;
}) {
  return <TouchTooltip label={tooltip}><button aria-label={label} aria-pressed={pressed} title={tooltip} disabled={disabled}
    className={`flex h-8 w-8 items-center justify-center rounded-lg border enabled:hover:ring-2 enabled:hover:ring-canvas-ink focus-visible:ring-2 focus-visible:ring-canvas-ink disabled:cursor-not-allowed disabled:border-canvas-line disabled:bg-canvas-surface disabled:text-canvas-muted disabled:opacity-40 ${pressed === true ? "border-canvas-ink bg-canvas-ink text-canvas-on-ink" : pressed === "mixed" ? "border-dashed border-canvas-ink bg-canvas-surface" : "border-canvas-line text-canvas-muted enabled:hover:bg-canvas-surface enabled:hover:text-canvas-ink"}`}
    onClick={onClick} type="button"><Icon aria-hidden="true" className="h-4 w-4" /></button></TouchTooltip>;
}
