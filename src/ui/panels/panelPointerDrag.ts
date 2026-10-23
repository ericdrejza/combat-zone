import type { PointerEvent as ReactPointerEvent } from "react";

import type { DockSide, DropTarget } from "./PanelsShell";

const POINTER_DRAG_THRESHOLD = 4;

type PanelPointerDragOptions = {
  event: ReactPointerEvent<HTMLButtonElement>;
  onDragEnd: () => void;
  onDragStart: (panelId: string) => void;
  onDropPanel: (target: DropTarget, panelId?: string) => void;
  onPreviewDrop: (target: DropTarget) => void;
  panelId: string;
};

function isDockSide(value: string | undefined): value is DockSide {
  return value === "left" || value === "right";
}

/** Resolves a pointer location through the same panel, marker, and dock targets as mouse DnD. */
export function resolvePanelPointerDropTarget(
  clientX: number,
  clientY: number,
  fallbackElement?: Element | null
): DropTarget | null {
  const hit = document.elementFromPoint?.(clientX, clientY) ?? fallbackElement;
  let targetElement = hit?.closest<HTMLElement>("[data-panel-drop-side]");
  if (targetElement?.dataset.panelDropKind === "tabs" && Number.isFinite(clientX) && Number.isFinite(clientY)) {
    // Gaps and list edges resolve to the nearest tab, including wrapped rows.
    let nearest: HTMLElement | undefined;
    let nearestDistance = Infinity;
    for (const tab of targetElement.querySelectorAll<HTMLElement>('[data-panel-drop-kind="tab"]')) {
      const bounds = tab.getBoundingClientRect();
      const dx = Math.max(bounds.left - clientX, 0, clientX - bounds.right);
      const dy = Math.max(bounds.top - clientY, 0, clientY - bounds.bottom);
      const distance = dx * dx + dy * dy;
      if (distance < nearestDistance) { nearestDistance = distance; nearest = tab; }
    }
    targetElement = nearest ?? targetElement;
  }
  const side = targetElement?.dataset.panelDropSide;
  const rawIndex = targetElement?.dataset.panelDropIndex;

  if (!targetElement || !isDockSide(side) || rawIndex === undefined) {
    return null;
  }

  const index = Number(rawIndex);
  if (!Number.isInteger(index)) {
    return null;
  }

  if (targetElement.dataset.panelDropKind !== "panel" && targetElement.dataset.panelDropKind !== "tab") {
    return { side, index };
  }

  const bounds = targetElement.getBoundingClientRect();
  return {
    side,
    index: (targetElement.dataset.panelDropAxis === "horizontal"
      ? clientX > bounds.left + bounds.width / 2
      : clientY > bounds.top + bounds.height / 2) ? index + 1 : index
  };
}

/** Adds one captured reorder gesture for mouse, touch, and pen input. */
export function startPanelPointerDrag({
  event,
  onDragEnd,
  onDragStart,
  onDropPanel,
  onPreviewDrop,
  panelId
}: PanelPointerDragOptions): void {
  if (event.button !== 0 || event.isPrimary === false) {
    return;
  }

  event.preventDefault();
  const handle = event.currentTarget;
  const pointerId = event.pointerId;
  const start = { x: event.clientX, y: event.clientY };
  // A non-drop surface preserves placement, so preview the source rather than a stale target.
  const source = handle.closest<HTMLElement>('[data-panel-drop-kind="panel"], [data-panel-drop-kind="tab"]');
  const sourceSide = source?.dataset.panelDropSide;
  const sourceIndex = Number(source?.dataset.panelDropIndex);
  const originalTarget: DropTarget | null = isDockSide(sourceSide) && Number.isInteger(sourceIndex)
    ? { side: sourceSide, index: sourceIndex }
    : null;
  let dragging = false;
  let lastTarget: DropTarget | null = null;

  handle.setPointerCapture?.(pointerId);

  function cleanup() {
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
    window.removeEventListener("pointercancel", handlePointerCancel);
  }

  function handlePointerMove(pointerEvent: PointerEvent) {
    if (pointerEvent.pointerId !== pointerId) return;

    const distance = Math.hypot(
      pointerEvent.clientX - start.x,
      pointerEvent.clientY - start.y
    );
    if (!dragging && distance < POINTER_DRAG_THRESHOLD) return;

    pointerEvent.preventDefault();
    if (!dragging) {
      dragging = true;
      onDragStart(panelId);
    }

    const target = resolvePanelPointerDropTarget(
      pointerEvent.clientX,
      pointerEvent.clientY
    ) ?? originalTarget;
    if (
      target &&
      (target.side !== lastTarget?.side || target.index !== lastTarget.index)
    ) {
      lastTarget = target;
      onPreviewDrop(target);
    }
  }

  function handlePointerUp(pointerEvent: PointerEvent) {
    if (pointerEvent.pointerId !== pointerId) return;
    cleanup();

    const target = dragging
      ? resolvePanelPointerDropTarget(pointerEvent.clientX, pointerEvent.clientY)
      : null;
    if (target) {
      // The listener closes over the pre-drag render, so carry the authoritative
      // panel ID instead of depending on asynchronously rendered drag state.
      onDropPanel(target, panelId);
    } else {
      onDragEnd();
    }
  }

  function handlePointerCancel(pointerEvent: PointerEvent) {
    if (pointerEvent.pointerId !== pointerId) return;
    cleanup();
    onDragEnd();
  }

  window.addEventListener("pointermove", handlePointerMove, { passive: false });
  window.addEventListener("pointerup", handlePointerUp);
  window.addEventListener("pointercancel", handlePointerCancel);
}
