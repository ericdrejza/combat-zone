import { useEffect, useState } from "react";

import { ZONELESS_ACTOR_ZONE_ID } from "@core/encounter/types";
import { clearSelection } from "@interaction/interactionState";
import type { AppDispatch, RootState } from "@store/store";
import { findZoneIdAtPoint } from "./actors/actorCanvasLayout";
import {
  commitActorFromCreation,
  commitActorFromLibraryNode,
  moveActorsToZone
} from "./canvasDropMutations";
import {
  COMPACT_CANVAS_TRANSFER_EVENT,
  type ActorTransferVisual,
  type CompactCanvasTransferDetail
} from "./compactCanvasTransfer";
import { toSvgPoint } from "./zones/zoneGeometry";
type UseCompactCanvasTransferInput = {
  actorTool: RootState["interaction"]["actorTool"];
  activeToolId: RootState["interaction"]["activeToolId"];
  canvasRef: { current: SVGSVGElement | null };
  dispatch: AppDispatch;
  encounter: RootState["encounter"]["present"];
  library: RootState["library"];
};

export type CompactTransferPreview = {
  actor?: ActorTransferVisual;
  clientX: number;
  clientY: number;
  label: string;
} | null;

/** Owns a pointer transfer after its source surface has safely unmounted. */
export function useCompactCanvasTransfer({
  activeToolId,
  actorTool,
  canvasRef,
  dispatch,
  encounter,
  library
}: UseCompactCanvasTransferInput): CompactTransferPreview {
  const [preview, setPreview] = useState<CompactTransferPreview>(null);

  useEffect(() => {
    function handleTransferStart(event: Event) {
      const { detail } = event as CustomEvent<CompactCanvasTransferDetail>;
      const { payload, pointerId } = detail;

      if (
        ((payload.kind === "library-node" || payload.kind === "new-actor") &&
          activeToolId !== "actor") ||
        (payload.kind === "zoneless-actors" &&
          activeToolId !== "actor" &&
          activeToolId !== "select")
      ) {
        return;
      }

      if (payload.kind === "library-node") {
        dispatch(clearSelection());
      }

      const label =
        payload.kind === "library-node"
          ? library.sections.tokens.nodesById[payload.nodeId]?.name ?? "Actor"
          : payload.kind === "new-actor"
            ? payload.actor.name
            : `${payload.actorIds.length} actor${payload.actorIds.length === 1 ? "" : "s"}`;
      const actor =
        payload.kind === "new-actor" || payload.kind === "zoneless-actors"
          ? payload.actor
          : undefined;
      setPreview({ actor, clientX: detail.clientX, clientY: detail.clientY, label });

      const mutationContext = { actorTool, dispatch, encounter, library };
      const cleanup = () => {
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleUp);
        window.removeEventListener("pointercancel", handleCancel);
        setPreview(null);
        detail.onTransferEnd?.();
      };
      const handleMove = (moveEvent: PointerEvent) => {
        if (moveEvent.pointerId === pointerId) {
          setPreview({ actor, clientX: moveEvent.clientX, clientY: moveEvent.clientY, label });
        }
      };
      const handleUp = (upEvent: PointerEvent) => {
        if (upEvent.pointerId !== pointerId) {
          return;
        }

        const svg = canvasRef.current;
        if (svg) {
          const bounds = svg.getBoundingClientRect();
          const insideCanvas =
            upEvent.clientX >= bounds.left &&
            upEvent.clientX <= bounds.right &&
            upEvent.clientY >= bounds.top &&
            upEvent.clientY <= bounds.bottom;

          if (insideCanvas) {
            const point = toSvgPoint(upEvent, svg);
            const destinationZoneId = findZoneIdAtPoint(encounter, point);

            if (payload.kind === "library-node") {
              commitActorFromLibraryNode(
                mutationContext,
                payload.nodeId,
                destinationZoneId ?? ZONELESS_ACTOR_ZONE_ID,
                point
              );
            } else if (payload.kind === "new-actor") {
              commitActorFromCreation(
                mutationContext,
                payload.actor,
                destinationZoneId ?? ZONELESS_ACTOR_ZONE_ID,
                point
              );
            } else if (destinationZoneId) {
              const actorIds = payload.actorIds.filter(
                (actorId) =>
                  encounter.actors.byId[actorId]?.currentZoneId ===
                  ZONELESS_ACTOR_ZONE_ID
              );
              if (actorIds.length > 0) {
                moveActorsToZone(
                  mutationContext,
                  actorIds,
                  destinationZoneId,
                  false,
                  point
                );
              }
            }
          }
        }
        cleanup();
      };
      const handleCancel = (cancelEvent: PointerEvent) => {
        if (cancelEvent.pointerId === pointerId) {
          cleanup();
        }
      };

      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp);
      window.addEventListener("pointercancel", handleCancel);
    }

    window.addEventListener(COMPACT_CANVAS_TRANSFER_EVENT, handleTransferStart);
    return () =>
      window.removeEventListener(COMPACT_CANVAS_TRANSFER_EVENT, handleTransferStart);
  }, [activeToolId, actorTool, canvasRef, dispatch, encounter, library]);

  return preview;
}
