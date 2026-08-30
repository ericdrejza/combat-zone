import type { Actor } from "@entities/actor/types";
import type { NewActorDragData } from "@ui/toolbar/actor/actorCreationDrag";

export const COMPACT_CANVAS_TRANSFER_EVENT = "combat-zone:compact-canvas-transfer";

export type ActorTransferVisual = NewActorDragData & Pick<Actor, "image">;

export type CompactCanvasTransferPayload =
  | {
      actor: ActorTransferVisual;
      actorIds: string[];
      kind: "zoneless-actors";
    }
  | { actor: NewActorDragData; kind: "new-actor" }
  | { kind: "library-node"; nodeId: string };

export type CompactCanvasTransferDetail = {
  clientX: number;
  clientY: number;
  onTransferEnd?: () => void;
  payload: CompactCanvasTransferPayload;
  pointerId: number;
};

const TRANSFER_THRESHOLD_PX = 8;

/** Arms a pointer transfer, handing it to the canvas only after intentional movement. */
export function armCompactCanvasTransfer(
  event: PointerEvent,
  payload: CompactCanvasTransferPayload,
  onTransferStart?: () => void,
  pointerTypes: "touch" | "all" = "touch",
  onTransferEnd?: () => void
): void {
  if (
    event.button !== 0 ||
    (pointerTypes === "touch" && event.pointerType !== "touch")
  ) {
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
          pointerId,
          ...(onTransferEnd ? { onTransferEnd } : {})
        }
      })
    );
    onTransferStart?.();
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
