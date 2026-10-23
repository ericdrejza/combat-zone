import { UsersRound } from "lucide-react";
import { TouchTooltip } from "@ui/toolbar/TouchTooltip";

export function GroupByFactionButton({ grouped, onChange }: { grouped: boolean; onChange: (value: boolean) => void }) {
  const help = grouped ? "Ungroup actors by faction" : "Group actors by faction";
  return <TouchTooltip label={help}><button type="button" aria-label="Group by faction"
    aria-pressed={grouped} title={help} onClick={() => onChange(!grouped)}
    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canvas-ink ${
      grouped ? "border-canvas-ink bg-canvas-ink text-canvas-on-ink hover:bg-canvas-ink/80"
        : "border-current text-inherit hover:bg-canvas hover:text-canvas-ink"
    }`}>
    <UsersRound aria-hidden="true" className="h-4 w-4" />
  </button></TouchTooltip>;
}
