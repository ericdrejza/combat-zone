import { useAnimationFrame } from "motion/react";
import { useEffect, useRef } from "react";

import { getDragAutoScrollDelta, getDragAutoScrollTarget } from "./dragAutoScroll";
import { resolvePanelPointerDropTarget } from "./panelPointerDrag";
import type { DropTarget } from "./PanelsShell";

/** Scroll only the hovered dock and refresh insertion previews beneath a stationary pointer. */
export function usePanelReorderAutoScroll(
  active: boolean,
  onPreviewDrop: (target: DropTarget) => void,
  axis: "vertical" | "horizontal" = "vertical"
) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const lastTarget = useRef<DropTarget | null>(null);

  useEffect(() => {
    function update(event: PointerEvent | DragEvent) {
      pointer.current = { x: event.clientX, y: event.clientY };
    }
    function stop() {
      pointer.current = null;
      lastTarget.current = null;
    }
    // Capture native dragover before panel and marker handlers stop propagation.
    window.addEventListener("pointermove", update, true);
    window.addEventListener("dragover", update, true);
    const stopEvents = ["pointerup", "pointercancel", "drop", "dragend", "blur"] as const;
    stopEvents.forEach(type => window.addEventListener(type, stop, true));
    return () => {
      window.removeEventListener("pointermove", update, true);
      window.removeEventListener("dragover", update, true);
      stopEvents.forEach(type => window.removeEventListener(type, stop, true));
      stop();
    };
  }, []);

  useAnimationFrame((_time, elapsed) => {
    const list = scrollRef.current;
    const point = pointer.current;
    if (!active || !list || !point) return;
    const bounds = list.getBoundingClientRect();
    const horizontal = axis === "horizontal";
    // Vertical docks include the insertion marker in the existing header gap.
    if (point.x < bounds.left || point.x > bounds.right ||
        point.y < bounds.top - (horizontal ? 0 : 8) || point.y > bounds.bottom) return;
    const delta = getDragAutoScrollDelta(horizontal ? { top: bounds.left, bottom: bounds.right } : bounds,
      horizontal ? point.x : point.y);
    if (delta === 0) return;
    const target = getDragAutoScrollTarget(
      horizontal ? list.scrollLeft : list.scrollTop,
      horizontal ? list.scrollWidth : list.scrollHeight,
      horizontal ? list.clientWidth : list.clientHeight,
      delta * Math.min(elapsed, 32) / (1000 / 60)
    );
    if (target === null || target === (horizontal ? list.scrollLeft : list.scrollTop)) return;
    if (horizontal) list.scrollLeft = target;
    else list.scrollTop = target;
    const drop = resolvePanelPointerDropTarget(point.x, point.y);
    if (drop && (drop.side !== lastTarget.current?.side || drop.index !== lastTarget.current.index)) {
      lastTarget.current = drop;
      onPreviewDrop(drop);
    }
  });

  return scrollRef;
}
