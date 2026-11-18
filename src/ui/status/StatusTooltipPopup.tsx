import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Shared positioning and appearance for HTML and SVG status markers. */
export function StatusTooltipPopup({ anchor, label, id, placement = "auto", tone = "default" }: { anchor: Element; label: ReactNode; id: string; placement?: "auto" | "bottom"; tone?: "default" | "warning" | "panel" }) {
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
        top: placement !== "bottom" && bounds.top >= height + 16 ? bounds.top - height - 8 : bounds.bottom + 8
      });
    }
    update();
    ownerWindow?.addEventListener("resize", update);
    ownerWindow?.addEventListener("scroll", update, true);
    return () => { ownerWindow?.removeEventListener("resize", update); ownerWindow?.removeEventListener("scroll", update, true); };
  }, [anchor, label, placement]);
  const colors = tone === "warning" ? "border border-amber-500/70 bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300"
    : tone === "panel" ? "border border-canvas-line bg-canvas-panel text-canvas-ink" : "bg-canvas-ink text-canvas-on-ink";
  return createPortal(<div ref={ref} id={id} role="tooltip" style={position} className={`pointer-events-none fixed z-[100] w-max max-w-[calc(100vw-1rem)] rounded-md px-2 py-1 text-center text-xs font-medium shadow-lg ${colors}`}>{label}</div>, anchor.ownerDocument.body);
}
