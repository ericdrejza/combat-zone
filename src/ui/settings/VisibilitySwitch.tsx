import { TouchTooltip } from "@ui/toolbar/TouchTooltip";
import { useId } from "react";
import { SettingsRow } from "./SettingsLayout";
import { Eye, EyeOff } from "lucide-react";

/** Consistent visibility controls for panels and their sections. */
export function VisibilitySwitch({ label, ariaLabel, tooltipLabel = label, visible, onChange }: {
  label: string; ariaLabel: string; tooltipLabel?: string; visible: boolean; onChange: (visible: boolean) => void;
}) {
  const id = useId();
  const Icon = visible ? Eye : EyeOff;
  return <SettingsRow controlId={id} label={label}>
    <div className="flex justify-end"><TouchTooltip label={`${visible ? "Hide" : "Show"} ${tooltipLabel}`}>
    <button id={id} aria-checked={visible} aria-label={ariaLabel} className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border enabled:hover:ring-2 enabled:hover:ring-canvas-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canvas-ink ${visible ? "border-canvas-ink bg-canvas-ink text-canvas-on-ink" : "border-canvas-line bg-canvas text-canvas-muted enabled:hover:bg-canvas-surface enabled:hover:text-canvas-ink"}`} onClick={() => onChange(!visible)} role="switch" title={`${visible ? "Hide" : "Show"} ${tooltipLabel}`} type="button">
      <Icon aria-hidden="true" className="h-4 w-4" />
    </button>
    </TouchTooltip></div>
  </SettingsRow>;
}
