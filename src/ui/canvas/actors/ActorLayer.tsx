import { motion } from "motion/react";

import type { LayoutPoint } from "@core/layout/types";
import { ACTOR_LAYOUT_GROUP_COLORS } from "@entities/actor/actorVisuals";
import type { RootState } from "@store/store";
import type {
  ActorDragEndEvent,
  ActorDragStartEvent,
  ActorDragState
} from "../canvasInteractionTypes";
import type { ActorRenderPlacement } from "./actorCanvasLayout";
import type { ActorPlacementTranslation } from "./actorPlacementTranslation";
import {
  getTextColorForLuminance,
  getZoneNameTextColor
} from "../canvasLuminance";
import { ActorVisual } from "./ActorVisual";
import { ActorMotionTrack } from "./ActorMotionTrack";
import { getCanvasTransition } from "../canvasMotion";
import { useMotionPreference } from "../../motion_preferences/MotionPreferenceProvider";
import { clearOptimisticActorPlacement } from "./actorPlacementOptimisticState";

type ActorLayerProps = {
  activeToolId?: RootState["interaction"]["activeToolId"];
  actorDrag: ActorDragState | null;
  backgroundLuminanceByZoneId: Record<string, number>;
  canvasBackgroundLuminance: number;
  dragOverlay?: boolean;
  showFactionOutlines: boolean;
  encounter: RootState["encounter"]["present"];
  placements: ActorRenderPlacement[];
  zoneActorTranslation?: ActorPlacementTranslation | null;
  onActorMouseEnter: (actorId: string) => void;
  onActorMouseLeave: (actorId: string) => void;
  onActorDragStart?: (
    actorId: string,
    point: LayoutPoint,
    event: ActorDragStartEvent
  ) => void;
  onActorDrag?: (point: LayoutPoint) => void;
  onActorDragEnd?: (event: ActorDragEndEvent) => void;
  onActorReturnComplete?: () => void;
  selection: RootState["interaction"]["selection"];
};

function getDraggedPoint(
  actorId: string,
  point: LayoutPoint,
  actorDrag: ActorDragState | null
): LayoutPoint {
  if (!actorDrag?.actorIds.includes(actorId)) {
    return point;
  }

  return {
    x: point.x + actorDrag.current.x - actorDrag.start.x,
    y: point.y + actorDrag.current.y - actorDrag.start.y
  };
}

function getZoneMovedPoint(
  actorZoneId: string,
  point: LayoutPoint,
  translation: ActorPlacementTranslation | null
): LayoutPoint {
  if (!translation || actorZoneId !== translation.zoneId) {
    return point;
  }

  return {
    x: point.x + translation.offset.x,
    y: point.y + translation.offset.y
  };
}

export function ActorLayer({
  activeToolId = "actor",
  actorDrag,
  backgroundLuminanceByZoneId,
  canvasBackgroundLuminance,
  dragOverlay = false,
  showFactionOutlines,
  encounter,
  placements,
  zoneActorTranslation = null,
  onActorMouseEnter,
  onActorMouseLeave,
  selection,
  onActorDragStart,
  onActorDrag,
  onActorDragEnd,
  onActorReturnComplete
}: ActorLayerProps) {
  const { animationsDisabled } = useMotionPreference();

  return placements
    .filter(({ actor }) => {
      if (dragOverlay) {
        return Boolean(actorDrag?.actorIds.includes(actor.id));
      }

      return true;
    })
    .map(({ actor, incomingPoint: placementIncomingPoint, point, radius }) => {
      const zoneMovedPoint = getZoneMovedPoint(
        actor.currentZoneId,
        point,
        zoneActorTranslation
      );
      const isMotionDraggedActor =
        !dragOverlay &&
        actorDrag?.phase === "dragging" &&
        actorDrag.actorId === actor.id;
      const renderedPoint = isMotionDraggedActor
        ? zoneMovedPoint
        : getDraggedPoint(actor.id, zoneMovedPoint, actorDrag);
      const incomingPoint = placementIncomingPoint
        ? getDraggedPoint(
            actor.id,
            getZoneMovedPoint(
              actor.currentZoneId,
              placementIncomingPoint,
              zoneActorTranslation
            ),
            actorDrag
          )
        : undefined;
      const isDirectManipulation = Boolean(
        (actorDrag?.phase === "dragging" &&
          actorDrag.actorIds.includes(actor.id)) ||
          (zoneActorTranslation &&
            actor.currentZoneId === zoneActorTranslation.zoneId)
      );
      const selected =
        selection.selectedEntityType === "actor" &&
        selection.selectedIds.includes(actor.id);
      const colors = ACTOR_LAYOUT_GROUP_COLORS[actor.layoutGroup];
      const actorZone = encounter.zones.byId[actor.currentZoneId];
      const selectedActorTextColor = actorZone
        ? getZoneNameTextColor(
            actorZone,
            backgroundLuminanceByZoneId[actorZone.id]
          )
        : getTextColorForLuminance(canvasBackgroundLuminance);
      const clipId = `${actor.id}-clip${dragOverlay ? "-drag-overlay" : ""}`;
      const actorTransition = getCanvasTransition(
        isDirectManipulation,
        animationsDisabled
      );
      return (
        <ActorMotionTrack
          key={actor.id}
          direct={isDirectManipulation}
          incomingPoint={incomingPoint}
          onIncomingPointCommitted={() =>
            clearOptimisticActorPlacement(actor.id)
          }
          target={renderedPoint}
        >
          {(animatePoint, completeTrack) => (
            <motion.g
              aria-label={actor.name}
              className="cursor-grab select-none active:cursor-grabbing"
              data-entity-id={actor.id}
              data-entity-type="actor"
              style={{
                opacity:
                  !dragOverlay && actorDrag?.actorIds.includes(actor.id) ? 0 : 1
              }}
              onMouseEnter={
                activeToolId === "zone"
                  ? undefined
                  : () => onActorMouseEnter(actor.id)
              }
              onMouseLeave={
                activeToolId === "zone"
                  ? undefined
                  : () => onActorMouseLeave(actor.id)
              }
              drag={
                !dragOverlay &&
                (activeToolId === "actor" || activeToolId === "select")
              }
              dragMomentum={false}
              dragElastic={0}
              onDragStart={(event) =>
                onActorDragStart?.(actor.id, zoneMovedPoint, event)
              }
              onDrag={(_, info) =>
                onActorDrag?.({
                  x: zoneMovedPoint.x + info.offset.x,
                  y: zoneMovedPoint.y + info.offset.y
                })
              }
              onDragEnd={(event) => onActorDragEnd?.(event)}
              initial={false}
              animate={isMotionDraggedActor ? undefined : animatePoint}
              transition={actorTransition}
              onAnimationComplete={() => {
                completeTrack();

                if (
                  !dragOverlay &&
                  actorDrag?.phase === "returning" &&
                  actorDrag.actorId === actor.id
                ) {
                  onActorReturnComplete?.();
                }
              }}
            >
              <ActorVisual
                actor={actor}
                clipId={clipId}
                fillColor={colors.fill}
                outlineColor={colors.outline}
                radius={radius}
                selected={selected}
                selectedTextColor={selectedActorTextColor}
                showFactionOutline={showFactionOutlines}
                transition={actorTransition}
              />
            </motion.g>
          )}
        </ActorMotionTrack>
      );
    });
}
