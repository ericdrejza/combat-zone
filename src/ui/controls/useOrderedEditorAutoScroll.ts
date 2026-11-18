import { useAnimationFrame } from "motion/react";
import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { AUTO_SCROLL_EDGE_PX, getDragAutoScrollDelta, getDragAutoScrollTarget } from "@ui/panels/dragAutoScroll";

type Drag = { id: string; pointerId: number; x: number; y: number; centerOffset: number; contentHeight: number; active: boolean };
const sameOrder = (a: string[], b: string[]) => a.length === b.length && a.every((id, i) => id === b[i]);

/** Scroll only the list being dragged, continuing while the pointer rests at an edge. */
export function useOrderedEditorAutoScroll(ids: string[], onReorder: (ids: string[]) => void, disabled: boolean) {
  const listRef = useRef<HTMLOListElement | null>(null);
  const drag = useRef<Drag | null>(null);
  const current = useRef({ ids, onReorder, disabled });
  current.current = { ids, onReorder, disabled };
  const requestedFrom = useRef<string[] | null>(null);
  function stop() { drag.current = null; requestedFrom.current = null; }

  useEffect(() => {
    const document = listRef.current?.ownerDocument;
    const window = document?.defaultView;
    if (!window) return;
    const move = (event: PointerEvent) => {
      if (drag.current?.pointerId === event.pointerId) { drag.current.x = event.clientX; drag.current.y = event.clientY; }
    };
    const release = (event: PointerEvent) => { if (drag.current?.pointerId === event.pointerId) stop(); };
    const visibility = () => { if (document?.hidden) stop(); };
    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerup", release, true);
    window.addEventListener("pointercancel", release, true);
    window.addEventListener("blur", stop);
    document?.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", release, true);
      window.removeEventListener("pointercancel", release, true);
      window.removeEventListener("blur", stop);
      document?.removeEventListener("visibilitychange", visibility);
      stop();
    };
  }, []);
  useEffect(() => { if (disabled) stop(); }, [disabled]);

  useAnimationFrame((_time, elapsed) => {
    const list = listRef.current, pointer = drag.current, latest = current.current;
    if (!list || !pointer?.active || latest.disabled || !latest.ids.includes(pointer.id)) return;
    const bounds = list.getBoundingClientRect();
    if (pointer.x < bounds.left || pointer.x > bounds.right || pointer.y < bounds.top - AUTO_SCROLL_EDGE_PX || pointer.y > bounds.bottom + AUTO_SCROLL_EDGE_PX) return;
    const delta = getDragAutoScrollDelta(bounds, pointer.y);
    if (!delta) return;
    const target = getDragAutoScrollTarget(list.scrollTop, pointer.contentHeight, list.clientHeight, delta * Math.min(elapsed, 32) / (1000 / 60));
    if (target !== null && target !== list.scrollTop) list.scrollTop = target;

    // Motion tracks scroll in the drag transform, but a stationary pointer has
    // zero velocity. Compare layout centers so newly revealed rows still reorder.
    if (requestedFrom.current && sameOrder(requestedFrom.current, latest.ids)) return;
    const index = latest.ids.indexOf(pointer.id), direction = Math.sign(delta);
    const nextId = latest.ids[index + direction];
    const row = Array.from(list.querySelectorAll<HTMLElement>("[data-order-id]")).find(item => item.dataset.orderId === nextId);
    if (!row) return;
    const center = bounds.top + row.offsetTop + row.offsetHeight / 2 - list.scrollTop;
    const draggedCenter = pointer.y + pointer.centerOffset;
    if (direction > 0 ? draggedCenter < center : draggedCenter > center) return;
    const next = [...latest.ids]; [next[index], next[index + direction]] = [next[index + direction], next[index]];
    requestedFrom.current = latest.ids;
    latest.onReorder(next);
  });

  return {
    listRef,
    prepare(id: string, event: ReactPointerEvent<HTMLButtonElement>) {
      if (disabled || event.button !== 0 || drag.current?.active && drag.current.pointerId !== event.pointerId) return false;
      const row = event.currentTarget.closest("[data-order-id]")?.getBoundingClientRect();
      drag.current = { id, pointerId: event.pointerId, x: event.clientX, y: event.clientY,
        centerOffset: row ? row.top + row.height / 2 - event.clientY : 0,
        // A translated drag item can inflate scrollHeight beyond the real list.
        contentHeight: listRef.current?.scrollHeight ?? 0, active: false };
      requestedFrom.current = null;
      return true;
    },
    start() { if (drag.current) drag.current.active = true; },
    stop
  };
}
