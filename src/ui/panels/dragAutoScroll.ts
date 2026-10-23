const AUTO_SCROLL_EDGE_PX = 40;
const AUTO_SCROLL_MAX_STEP_PX = 14;

export function getDragAutoScrollDelta(
  bounds: Pick<DOMRect, "bottom" | "top">,
  pointerClientY: number
): number {
  const distanceFromTop = pointerClientY - bounds.top;
  if (distanceFromTop < AUTO_SCROLL_EDGE_PX) {
    return -Math.ceil(
      AUTO_SCROLL_MAX_STEP_PX *
        (1 - Math.max(0, distanceFromTop) / AUTO_SCROLL_EDGE_PX)
    );
  }
  const distanceFromBottom = bounds.bottom - pointerClientY;
  if (distanceFromBottom < AUTO_SCROLL_EDGE_PX) {
    return Math.ceil(
      AUTO_SCROLL_MAX_STEP_PX *
        (1 - Math.max(0, distanceFromBottom) / AUTO_SCROLL_EDGE_PX)
    );
  }
  return 0;
}

export function getDragAutoScrollTarget(
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number,
  delta: number
): number | null {
  const maximumScrollTop = Math.max(0, scrollHeight - clientHeight);
  if ((delta < 0 && scrollTop <= 0) || (delta > 0 && scrollTop >= maximumScrollTop)) {
    return null;
  }

  return Math.min(maximumScrollTop, Math.max(0, scrollTop + delta));
}
