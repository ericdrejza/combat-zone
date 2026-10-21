import { RECENT_CUSTOM_COLOR_LIMIT } from "@ui/interface_preferences/recentCustomColors";
import { TouchTooltip } from "@ui/toolbar/TouchTooltip";

/** A single aligned row reserves seven slots for recent custom choices. */
export function RecentColorSwatches({ label, colors, value, onChange }: {
  label: string; colors: string[]; value: string; onChange: (color: string) => void;
}) {
  return <div role="group" aria-label={`${label} recent custom colors`} className="space-y-1 border-t border-canvas-line pt-2">
    <p className="text-xs text-canvas-muted">Recent custom colors</p>
    <div className="grid w-full max-w-[14rem] grid-cols-7 gap-1">
      {Array.from({ length: RECENT_CUSTOM_COLOR_LIMIT }, (_, index) => {
        const color = colors[index];
        if (!color) return <span key={index} aria-hidden="true" className="aspect-square rounded-md border border-dashed border-canvas-line bg-canvas" />;
        const title = `${label} recent ${color}`;
        return <TouchTooltip key={index} label={title}><button type="button" title={title} aria-label={title}
          aria-pressed={value.toLowerCase() === color}
          className={`aspect-square w-full rounded-md border hover:ring-2 hover:ring-canvas-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canvas-ink ${value.toLowerCase() === color ? "border-canvas-ink ring-2 ring-canvas-ink/25" : "border-canvas-line"}`}
          style={{ backgroundColor: color }} onClick={() => onChange(color)} /></TouchTooltip>;
      })}
    </div>
  </div>;
}
