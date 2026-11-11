import { Shuffle } from "lucide-react";
import { useId } from "react";

import type { AudioCueGroup } from "@entities/audio/types";
import { StatusMarkerTooltip } from "@ui/status/StatusMarkerTooltip";

export function AudioGroupShuffleButton({ group, onToggle }: { group: AudioCueGroup; onToggle: () => void }) {
  const id = useId();
  return <StatusMarkerTooltip id={id} label="Play one random sound per trigger. Manual playback plays all sounds.">
    <button aria-label={`Shuffle triggers for ${group.name}`} aria-pressed={Boolean(group.shuffleTriggers)} className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border hover:ring-2 hover:ring-canvas-ink focus-visible:ring-2 focus-visible:ring-canvas-ink ${group.shuffleTriggers ? "border-canvas-ink bg-canvas-ink text-canvas-on-ink" : "border-canvas-line"}`} onClick={onToggle} type="button">
      <Shuffle aria-hidden="true" className="h-4 w-4" />
    </button>
  </StatusMarkerTooltip>;
}
