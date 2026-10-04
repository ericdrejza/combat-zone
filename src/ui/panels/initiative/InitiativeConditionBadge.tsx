import { useId, useRef, useState } from "react";
import type { StatusMarker } from "@ui/status/markerCatalog";
import { TouchTooltip } from "@ui/toolbar/TouchTooltip";
import { InitiativeConditionTooltip } from "./InitiativeConditionTooltip";

/** Individual icons use the same pill popup as the condensed Activity summary. */
export function InitiativeConditionBadge({ condition, actorName, disabled, hideTooltip, onRemove }: {
  condition: StatusMarker; actorName: string; disabled: boolean; hideTooltip: boolean; onRemove: (condition: StatusMarker) => void;
}) {
  const anchor = useRef<HTMLSpanElement>(null);
  const tooltipId = useId();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const open = !hideTooltip && (hovered || focused);
  function prompt() { setHovered(false); setFocused(false); onRemove(condition); }
  return <TouchTooltip label={condition.label}><span ref={anchor} className="inline-flex items-center rounded" tabIndex={disabled ? 0 : undefined} aria-label={disabled ? condition.label : undefined} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocus={() => setFocused(true)} onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget) && !anchor.current?.ownerDocument.getElementById(tooltipId)?.contains(event.relatedTarget)) setFocused(false);
  }} onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); setHovered(false); setFocused(false); } }}>
    <button aria-label={`Remove ${condition.label} from ${actorName}`} aria-describedby={open ? tooltipId : undefined} disabled={disabled} className="rounded enabled:hover:bg-canvas-panel enabled:hover:text-canvas-ink enabled:hover:ring-2 enabled:hover:ring-canvas-ink focus-visible:ring-2 focus-visible:ring-canvas-ink disabled:cursor-not-allowed disabled:opacity-40" onClick={(event) => { event.stopPropagation(); prompt(); }} type="button"><condition.Icon aria-hidden="true" className="h-4 w-4" /></button>
    {open && anchor.current ? <InitiativeConditionTooltip anchor={anchor.current} id={tooltipId} conditions={[condition]} actorName={actorName} disabled={disabled} onRemove={prompt} /> : null}
  </span></TouchTooltip>;
}
