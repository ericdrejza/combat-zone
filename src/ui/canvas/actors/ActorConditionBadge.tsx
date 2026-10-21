import { useEffect, useId, useRef, useState } from "react";
import { motion, type Transition } from "motion/react";
import type { StatusMarker } from "@ui/status/markerCatalog";
import { StatusTooltipPopup } from "@ui/status/StatusTooltipPopup";

/** Selected-token indicators share panel tooltip styling without becoming condition toggles. */
export function ActorConditionBadge({ marker, selected, x, y, size, transition }: {
  marker: StatusMarker; selected: boolean; x: number; y: number; size: number; transition: Transition;
}) {
  const anchor = useRef<SVGGElement>(null);
  const tooltipId = useId();
  const [hovered, setHovered] = useState(false);
  useEffect(() => { if (!selected) setHovered(false); }, [selected]);
  const open = selected && hovered;
  return <motion.g ref={anchor} role="img" aria-label={marker.label} initial={false}
    animate={{ x, y }} transition={transition} pointerEvents={selected ? "all" : "none"}
    aria-describedby={open ? tooltipId : undefined} data-touch-tooltip-label={selected ? marker.label : undefined}
    onPointerEnter={(event) => { if (selected && event.pointerType !== "touch") setHovered(true); }}
    onPointerLeave={() => setHovered(false)} onPointerCancel={() => setHovered(false)}>
    <rect width={size} height={size} rx={3}
      className="fill-canvas-panel stroke-canvas-line" strokeWidth={0.75} />
    <marker.Icon x={2} y={2} width={size - 4} height={size - 4} className="text-canvas-ink" aria-hidden="true" />
    {open && anchor.current ? <StatusTooltipPopup anchor={anchor.current} label={marker.label} id={tooltipId} /> : null}
  </motion.g>;
}
