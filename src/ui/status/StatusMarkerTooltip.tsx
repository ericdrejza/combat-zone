import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Immediate desktop help; the touch provider still discovers this wrapper on hold. */
export function StatusMarkerTooltip({ children, label, id }: { children: ReactNode; label: string; id: string }) {
  const anchor = useRef<HTMLSpanElement>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  return <span ref={anchor} className="inline-flex" data-touch-tooltip-label={label}
    onPointerEnter={(event) => { if (event.pointerType !== "touch") setHovered(true); }}
    onPointerLeave={() => setHovered(false)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
    onKeyDown={(event) => { if (event.key === "Escape") { setHovered(false); setFocused(false); } }}>
    {children}
    {(hovered || focused) && anchor.current ? <TooltipPopup anchor={anchor.current} label={label} id={id} /> : null}
  </span>;
}

function TooltipPopup({ anchor, label, id }: { anchor: HTMLElement; label: string; id: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  useLayoutEffect(() => {
    const ownerWindow = anchor.ownerDocument.defaultView;
    function update() {
      const bounds = anchor.getBoundingClientRect();
      const tooltip = ref.current?.getBoundingClientRect();
      const width = tooltip?.width ?? 0;
      const height = tooltip?.height ?? 0;
      setPosition({
        left: Math.max(8, Math.min(bounds.left + (bounds.width - width) / 2, (ownerWindow?.innerWidth ?? 0) - width - 8)),
        top: bounds.top >= height + 16 ? bounds.top - height - 8 : bounds.bottom + 8
      });
    }
    update();
    ownerWindow?.addEventListener("resize", update);
    ownerWindow?.addEventListener("scroll", update, true);
    return () => { ownerWindow?.removeEventListener("resize", update); ownerWindow?.removeEventListener("scroll", update, true); };
  }, [anchor, label]);
  return createPortal(<div ref={ref} id={id} role="tooltip" style={position} className="pointer-events-none fixed z-[100] w-max max-w-[calc(100vw-1rem)] rounded-md bg-canvas-ink px-2 py-1 text-center text-xs font-medium text-canvas-on-ink shadow-lg">{label}</div>, anchor.ownerDocument.body);
}
