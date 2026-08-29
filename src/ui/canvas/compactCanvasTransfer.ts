export const COMPACT_CANVAS_TRANSFER_EVENT = "combat-zone:compact-canvas-transfer";

export type CompactCanvasTransferPayload =
  | { actorIds: string[]; kind: "zoneless-actors" }
  | { kind: "library-node"; nodeId: string };

export type CompactCanvasTransferDetail = {
  clientX: number;
  clientY: number;
  payload: CompactCanvasTransferPayload;
  pointerId: number;
};

const TRANSFER_THRESHOLD_PX = 8;

/** Arms a touch transfer, handing it to the canvas only after intentional movement. */
export function armCompactCanvasTransfer(
  event: PointerEvent,
  payload: CompactCanvasTransferPayload
): void {
  if (event.pointerType !== "touch" || event.button !== 0) {
    return;
  }

  const start = { x: event.clientX, y: event.clientY };
  const pointerId = event.pointerId;

  const cleanup = () => {
    window.removeEventListener("pointermove", handleMove);
    window.removeEventListener("pointerup", handleEnd);
    window.removeEventListener("pointercancel", handleEnd);
  };
  const handleMove = (moveEvent: PointerEvent) => {
    if (moveEvent.pointerId !== pointerId) {
      return;
    }
    if (
      Math.hypot(moveEvent.clientX - start.x, moveEvent.clientY - start.y) <
      TRANSFER_THRESHOLD_PX
    ) {
      return;
    }

    cleanup();
    window.dispatchEvent(
      new CustomEvent<CompactCanvasTransferDetail>(COMPACT_CANVAS_TRANSFER_EVENT, {
        detail: {
          clientX: moveEvent.clientX,
          clientY: moveEvent.clientY,
          payload,
          pointerId
        }
      })
    );
  };
  const handleEnd = (endEvent: PointerEvent) => {
    if (endEvent.pointerId === pointerId) {
      cleanup();
    }
  };

  window.addEventListener("pointermove", handleMove);
  window.addEventListener("pointerup", handleEnd);
  window.addEventListener("pointercancel", handleEnd);
}
