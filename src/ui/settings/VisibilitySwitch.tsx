import { Eye, EyeOff } from "lucide-react";

/** Consistent visibility controls for panels and their sections. */
export function VisibilitySwitch({ label, ariaLabel, tooltipLabel = label, visible, onChange }: {
  label: string; ariaLabel: string; tooltipLabel?: string; visible: boolean; onChange: (visible: boolean) => void;
}) {
  const Icon = visible ? Eye : EyeOff;
  return <div className="flex min-h-10 items-center justify-between gap-4 py-2">
    <span className="text-sm">{label}</span>
    <button aria-checked={visible} aria-label={ariaLabel} className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border enabled:hover:ring-2 enabled:hover:ring-canvas-ink focus-visible:ring-2 focus-visible:ring-canvas-ink ${visible ? "border-canvas-ink bg-canvas-ink text-canvas-on-ink" : "border-canvas-line bg-canvas text-canvas-muted enabled:hover:bg-canvas-surface enabled:hover:text-canvas-ink"}`} onClick={() => onChange(!visible)} role="switch" title={`${visible ? "Hide" : "Show"} ${tooltipLabel}`} type="button">
      <Icon aria-hidden="true" className="h-4 w-4" />
    </button>
  </div>;
}
