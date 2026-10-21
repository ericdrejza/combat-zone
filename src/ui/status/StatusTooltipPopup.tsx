import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** Shared positioning and appearance for HTML and SVG status markers. */
export function StatusTooltipPopup({ anchor, label, id }: { anchor: Element; label: string; id: string }) {
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
