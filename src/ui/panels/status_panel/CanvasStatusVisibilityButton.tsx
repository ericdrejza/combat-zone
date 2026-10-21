import { Eye, EyeOff } from "lucide-react";
import { useInterfacePreferences } from "@ui/interface_preferences/InterfacePreferenceProvider";
import { TouchTooltip } from "@ui/toolbar/TouchTooltip";

/** Canvas presentation only; actor status values remain editable in both Status views. */
export function CanvasStatusVisibilityButton() {
  const { showActorStatusesOnCanvas, setShowActorStatusesOnCanvas } = useInterfacePreferences();
  const label = showActorStatusesOnCanvas ? "Hide actor statuses on canvas" : "Show actor statuses on canvas";
  const Icon = showActorStatusesOnCanvas ? Eye : EyeOff;
  return <TouchTooltip label={label}><button aria-label={label} aria-pressed={showActorStatusesOnCanvas}
    title={label} type="button" onClick={() => setShowActorStatusesOnCanvas(!showActorStatusesOnCanvas)}
    className={`flex h-8 w-8 items-center justify-center rounded-full border hover:ring-2 hover:ring-canvas-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canvas-ink ${showActorStatusesOnCanvas ? "border-canvas-ink bg-canvas-ink text-canvas-on-ink hover:bg-canvas-ink/80" : "border-canvas-line bg-canvas-surface text-canvas-muted hover:bg-canvas"}`}>
    <Icon aria-hidden="true" className="h-4 w-4" />
  </button></TouchTooltip>;
}
