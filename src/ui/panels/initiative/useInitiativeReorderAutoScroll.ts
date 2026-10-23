import { useEffect, useRef } from "react";

import {
  getDragAutoScrollDelta as getInitiativeAutoScrollDelta,
  getDragAutoScrollTarget as getInitiativeAutoScrollTarget
} from "@ui/panels/dragAutoScroll";

export { getInitiativeAutoScrollDelta, getInitiativeAutoScrollTarget };

/** Continuously scrolls the initiative viewport while a dragged row hugs an edge. */
export function useInitiativeReorderAutoScroll() {
  const listRef = useRef<HTMLOListElement>(null);
  const pointerClientYRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const blockedDirectionRef = useRef<-1 | 1 | null>(null);

  function stopAutoScroll() {
    pointerClientYRef.current = null;
    blockedDirectionRef.current = null;
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }

  function tick() {
    const list = listRef.current;
    const pointerClientY = pointerClientYRef.current;
    if (!list || pointerClientY === null) {
      animationFrameRef.current = null;
      return;
    }

    const delta = getInitiativeAutoScrollDelta(
      list.getBoundingClientRect(),
      pointerClientY
    );
    if (delta === 0) {
      blockedDirectionRef.current = null;
      animationFrameRef.current = null;
      return;
    }

    const direction = delta < 0 ? -1 : 1;
    const targetScrollTop = getInitiativeAutoScrollTarget(
      list.scrollTop,
      list.scrollHeight,
      list.clientHeight,
      delta
    );
    if (targetScrollTop === null) {
      blockedDirectionRef.current = direction;
      animationFrameRef.current = null;
      return;
    }

    const previousScrollTop = list.scrollTop;
    list.scrollTop = targetScrollTop;
    if (list.scrollTop === previousScrollTop) {
      blockedDirectionRef.current = direction;
      animationFrameRef.current = null;
      return;
    }

    blockedDirectionRef.current = null;
    animationFrameRef.current = requestAnimationFrame(tick);
  }

  function updateAutoScroll(pointerClientY: number) {
    pointerClientYRef.current = pointerClientY;
    const list = listRef.current;
    if (!list) return;

    const delta = getInitiativeAutoScrollDelta(
      list.getBoundingClientRect(),
      pointerClientY
    );
    const direction = delta < 0 ? -1 : delta > 0 ? 1 : null;
    if (direction === null) {
      blockedDirectionRef.current = null;
      return;
    }
    if (blockedDirectionRef.current === direction) return;
    blockedDirectionRef.current = null;

    if (animationFrameRef.current === null) {
      animationFrameRef.current = requestAnimationFrame(tick);
    }
  }

  useEffect(() => stopAutoScroll, []);

  return { listRef, stopAutoScroll, updateAutoScroll };
}
