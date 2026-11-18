import { useLayoutEffect, useState, type RefObject } from "react";

type Position = { left: number; top?: number; bottom?: number; width: number; maxHeight: number };
/** Anchor the portalled popup to its owning window, including compact/popout viewports. */
export function useEditorMenuPosition(anchor: RefObject<HTMLElement>, open: boolean) {
  const [position, setPosition] = useState<Position | null>(null);
  useLayoutEffect(() => {
    if (!open || !anchor.current) { setPosition(null); return; }
    const element = anchor.current;
    const document = element.ownerDocument;
    const window = document.defaultView;
    if (!window) return;
    const update = () => {
      const bounds = element.getBoundingClientRect();
      const viewport = window.visualViewport;
      const leftEdge = (viewport?.offsetLeft ?? 0) + 8;
      const topEdge = (viewport?.offsetTop ?? 0) + 8;
      const rightEdge = leftEdge + (viewport?.width ?? window.innerWidth) - 16;
      const bottomEdge = topEdge + (viewport?.height ?? window.innerHeight) - 16;
      const width = Math.min(bounds.width, rightEdge - leftEdge);
      const below = Math.max(0, bottomEdge - bounds.bottom - 4);
      const above = Math.max(0, bounds.top - topEdge - 4);
      const upward = below < 280 && above > below;
      const maxHeight = Math.min(320, upward ? above : below);
      const next = { left: Math.max(leftEdge, Math.min(bounds.left, rightEdge - width)),
        top: upward ? undefined : bounds.bottom + 4,
        bottom: upward ? window.innerHeight - bounds.top + 4 : undefined, width, maxHeight };
      setPosition(previous => previous && Object.keys(next).every(key => previous[key as keyof Position] === next[key as keyof Position]) ? previous : next);
    };
    update();
    window.addEventListener("resize", update);
    document.addEventListener("scroll", update, true);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    return () => {
      window.removeEventListener("resize", update);
      document.removeEventListener("scroll", update, true);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
    };
  }, [anchor, open]);
  return position;
}
