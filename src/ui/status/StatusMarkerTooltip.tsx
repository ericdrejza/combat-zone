import { useRef, useState, type ReactNode } from "react";
import { StatusTooltipPopup } from "./StatusTooltipPopup";

/** Immediate desktop help; the touch provider still discovers this wrapper on hold. */
export function StatusMarkerTooltip({ children, label, id }: { children: ReactNode; label: string; id: string }) {
  const anchor = useRef<HTMLSpanElement>(null);
  const pointerFocus = useRef(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  // A clicked toggle retains DOM focus, but only keyboard focus should keep help open.
  return <span ref={anchor} className="inline-flex" data-touch-tooltip-label={label}
    onPointerEnter={(event) => { if (event.pointerType !== "touch") setHovered(true); }}
    onPointerDownCapture={() => { pointerFocus.current = true; setFocused(false); }}
    onPointerLeave={() => setHovered(false)}
    onFocus={() => { if (!pointerFocus.current) setFocused(true); }}
    onBlur={() => { pointerFocus.current = false; setFocused(false); }}
    onKeyDown={(event) => {
      pointerFocus.current = false;
      if (event.key === "Escape") { setHovered(false); setFocused(false); }
      else setFocused(true);
    }}>
    {children}
    {(hovered || focused) && anchor.current ? <StatusTooltipPopup anchor={anchor.current} label={label} id={id} /> : null}
  </span>;
}
