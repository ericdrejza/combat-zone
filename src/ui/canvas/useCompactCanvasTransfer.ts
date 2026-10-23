import { transferDropSurface } from "./transferDropSurface";
import { isSpatial } from '@core/movement/movementStrategies';
import { useMotionValue, type MotionValue } from "motion/react";
import { useEffect, useState } from "react";

import { ZONELESS_ACTOR_ZONE_ID } from "@core/encounter/types";
import { clearSelection } from "@interaction/interactionState";
import { resolveLibraryAsset } from "@library/librarySlice";
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
  clientX: MotionValue<number>;
  clientY: MotionValue<number>;
  label: string;
} | null;

function getLibraryActorPreview(
  library: RootState["library"],
  actorTool: RootState["interaction"]["actorTool"],
  nodeId: string
): ActorTransferVisual | undefined {
  const asset = resolveLibraryAsset(library.sections.tokens, nodeId);

  if (!asset) {
    return undefined;
  }

  return {
    image: asset.source,
    imageAnimated: asset.animated,
    imageMediaType: asset.mediaType,
    imageName: asset.name,
    layoutGroup: actorTool.layoutGroup,
    name: asset.name,
    shape: actorTool.shape,
    size: actorTool.size
  };
}

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
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);

  useEffect(() => {
    let cancelTransfer: (() => void) | undefined;
    function handleTransferStart(event: Event) {
      cancelTransfer?.();
      const { detail } = event as CustomEvent<CompactCanvasTransferDetail>;
      const { payload, pointerId } = detail;

      if (
        ((payload.kind === "library-node" || payload.kind === "new-actor") &&
          activeToolId !== "actor") ||
        (payload.kind === "zoneless-actors" &&
          activeToolId !== "actor" &&
          activeToolId !== "select" && activeToolId !== "grid")
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
          : getLibraryActorPreview(library, actorTool, payload.nodeId);
      pointerX.set(detail.clientX);
      pointerY.set(detail.clientY);
      setPreview({ actor, clientX: pointerX, clientY: pointerY, label });

      const mutationContext = { actorTool, dispatch, encounter, library };
      const cleanup = () => {
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleUp);
        window.removeEventListener("pointercancel", handleCancel);
        window.removeEventListener("keydown", handleKeyDown);
        setPreview(null);
        detail.onTransferEnd?.();
        cancelTransfer = undefined;
      };
      cancelTransfer = cleanup;
      const handleMove = (moveEvent: PointerEvent) => {
        if (moveEvent.pointerId === pointerId) {
          // Pointer-frequency movement stays outside React so the canvas tree
          // is not reconciled for every mouse, touch, or pen event.
          pointerX.set(moveEvent.clientX);
          pointerY.set(moveEvent.clientY);
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

          const surface = transferDropSurface(upEvent, svg);
          if (surface === "zoneless" && payload.kind === "new-actor") {
            commitActorFromCreation(mutationContext, payload.actor, ZONELESS_ACTOR_ZONE_ID);
          } else if (surface === "zoneless" && payload.kind === "library-node") {
            commitActorFromLibraryNode(mutationContext, payload.nodeId, ZONELESS_ACTOR_ZONE_ID);
          } else if (insideCanvas && surface === "canvas") {
            const point = toSvgPoint(upEvent, svg);
            const destinationZoneId = isSpatial(encounter) ? ZONELESS_ACTOR_ZONE_ID : findZoneIdAtPoint(encounter, point);

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
                  (isSpatial(encounter) ? !!encounter.actors.byId[actorId] && !encounter.actors.byId[actorId].spatialPosition : encounter.actors.byId[actorId]?.currentZoneId === ZONELESS_ACTOR_ZONE_ID)
              );
              if (actorIds.length > 0) {
                moveActorsToZone(
                  mutationContext,
                  actorIds,
                  destinationZoneId,
                  false,
                  point,
                  true
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

      const handleKeyDown = (keyEvent: KeyboardEvent) => { if (keyEvent.key === "Escape") cleanup(); };
      window.addEventListener("keydown", handleKeyDown);
      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp);
      window.addEventListener("pointercancel", handleCancel);
    }

    window.addEventListener(COMPACT_CANVAS_TRANSFER_EVENT, handleTransferStart);
    return () => {
      cancelTransfer?.();
      window.removeEventListener(COMPACT_CANVAS_TRANSFER_EVENT, handleTransferStart);
    };
  }, [
    activeToolId,
    actorTool,
    canvasRef,
    dispatch,
    encounter,
    library,
    pointerX,
    pointerY
  ]);

  return preview;
}
