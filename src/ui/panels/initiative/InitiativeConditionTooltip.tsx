import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { StatusMarker } from "@ui/status/markerCatalog";

/** Portals into the owning window to avoid clipping in the initiative scroll area. */
export function InitiativeConditionTooltip({ anchor, id, conditions, actorName, disabled, onRemove }: { anchor: HTMLElement; id: string; conditions: StatusMarker[]; actorName: string; disabled: boolean; onRemove: (condition: StatusMarker) => void }) {
  const root = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  useLayoutEffect(() => {
    const ownerWindow = anchor.ownerDocument.defaultView;
    const positionTooltip = () => {
      const rect = anchor.getBoundingClientRect();
      const tooltip = root.current?.getBoundingClientRect();
      const width = ownerWindow?.innerWidth ?? 0;
      const height = ownerWindow?.innerHeight ?? 0;
      const tooltipWidth = tooltip?.width ?? 0;
      const tooltipHeight = tooltip?.height ?? 0;
      setPosition({
        left: Math.max(8, Math.min(rect.left, width - tooltipWidth - 8)),
        top: Math.max(8, rect.bottom + tooltipHeight + 8 <= height ? rect.bottom : rect.top - tooltipHeight)
      });
    };
    positionTooltip();
    ownerWindow?.addEventListener("resize", positionTooltip);
    ownerWindow?.addEventListener("scroll", positionTooltip, true);
    return () => { ownerWindow?.removeEventListener("resize", positionTooltip); ownerWindow?.removeEventListener("scroll", positionTooltip, true); };
  }, [anchor, conditions]);
  return createPortal(<div className="fixed z-[100] flex max-h-[70vh] w-max max-w-[min(24rem,calc(100vw-1rem))] flex-wrap gap-1 overflow-y-auto rounded-lg bg-canvas-ink p-3 text-xs text-canvas-on-ink shadow-lg" id={id} ref={root} role="tooltip" style={position}>
    {conditions.map((condition) => <button key={condition.id} aria-label={`Remove ${condition.label} from ${actorName}`} title={disabled ? "Read-only encounter" : `Remove ${condition.label}`} disabled={disabled} className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-canvas-on-ink/25 px-2 py-1 enabled:hover:bg-canvas-panel enabled:hover:text-canvas-ink focus-visible:ring-2 focus-visible:ring-canvas-on-ink disabled:cursor-not-allowed disabled:opacity-40" onClick={(event) => { event.stopPropagation(); onRemove(condition); }} type="button"><condition.Icon aria-hidden="true" className="h-4 w-4 shrink-0" /><span>{condition.label}</span></button>)}
  </div>, anchor.ownerDocument.body);
}
