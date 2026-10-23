import { Eye, EyeOff } from "lucide-react";
import { TouchTooltip } from "@ui/toolbar/TouchTooltip";

export function ZonelessVisibilityButton({ visible, onToggle }: { visible: boolean; onToggle: () => void }) {
  const label = visible ? "Hide Zoneless panel" : "Show Zoneless panel";
  return <TouchTooltip label={label}><button type="button" title={label} aria-label={label} aria-pressed={visible}
    onClick={onToggle} className="flex h-9 w-9 items-center justify-center rounded-full border border-canvas-line bg-canvas-panel text-canvas-ink hover:bg-canvas focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
    {visible ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
  </button></TouchTooltip>;
}
