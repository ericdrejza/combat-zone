import { usePlayerAudience, useSceneId } from '@ui/player_view/PlayerSceneSource';
import { previewedName, type NamePreview } from '@interaction/namePreviewState';
import { getDraggedPoint } from './actorDragPoint';
import { ActorTrim } from './ActorTrim';
import { useActorBackgroundPixel } from './ActorSurfaceProvider';
import { createActorSurfaceContrast } from './actorSurfaceContrast';
import { useCanvasPreferences } from '@ui/canvas_preferences/useCanvasPreferences';
import { ActorOverlayLayers } from "./ActorOverlayLayers";
import { ActorDragMotionGroup } from './ActorDragMotionGroup';

import type { LayoutPoint } from "@core/layout/types";
import { ACTOR_LAYOUT_GROUP_COLORS } from "@entities/actor/actorVisuals";
import type { RootState } from "@store/store";
import type {
  ActorDragEndEvent,
  ActorDragStartEvent,
  ActorDragState
} from "../canvasInteractionTypes";
import type { ActorRenderPlacement } from "./actorCanvasLayout";
import { transformZoneActorPoint, type ActorPlacementTranslation } from "./actorPlacementTranslation";
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
  namePreview?: NamePreview | null;
  activeToolId?: RootState["interaction"]["activeToolId"];
  actorDrag: ActorDragState | null;
  backgroundLuminanceByZoneId: Record<string, number>;
  canvasBackgroundLuminance: number;
  showFactionOutlines: boolean;
  encounter: RootState["encounter"]["present"];
  surfaceZones?: RootState['encounter']['present']['zones'];
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
  onIncomingPointCommitted?: (actorId: string) => void;
  onActorReturnComplete?: (actorId: string) => void;
  selection: RootState["interaction"]["selection"];
};

export function ActorLayer({
  namePreview = null,
  activeToolId = "actor",
  actorDrag,
  backgroundLuminanceByZoneId,
  canvasBackgroundLuminance,
  showFactionOutlines,
  encounter,
  surfaceZones = encounter.zones,
  placements,
  zoneActorTranslation = null,
  onActorMouseEnter,
  onActorMouseLeave,
  selection,
  onActorDragStart,
  onActorDrag,
  onActorDragEnd,
  onIncomingPointCommitted,
  onActorReturnComplete
}: ActorLayerProps) {
  const player = usePlayerAudience();
  const clipPrefix = useSceneId('');
  const { animationsDisabled } = useMotionPreference();
  const readBackground = useActorBackgroundPixel();
  const { preferences } = useCanvasPreferences();
  const projectionRotation = encounter.grid.type === 'isometric' && preferences.projectIsometricTokens
    ? encounter.grid.rotation : undefined;

  return <ActorOverlayLayers>{placements.map(
    ({ actor, incomingPoint: placementIncomingPoint, point, radius }) => {
      const name = previewedName(namePreview, encounter.id, 'actor', actor.id, actor.name);
      const zoneMovedPoint = transformZoneActorPoint(
        point,
        actor.currentZoneId,
        zoneActorTranslation
      );
      const isMotionDraggedActor =
        actorDrag?.phase === "dragging" &&
        actorDrag.actorId === actor.id;
      // Motion owns the lead token's live transform, but the track must retain
      // its visible endpoint for validation and drop settling, not its origin.
      const renderedPoint = getDraggedPoint(actor.id, zoneMovedPoint, actorDrag);
      const placementDropPoint = placementIncomingPoint
        ? getDraggedPoint(
            actor.id,
            transformZoneActorPoint(
              placementIncomingPoint,
              actor.currentZoneId,
              zoneActorTranslation
            ),
            actorDrag
          )
        : undefined;
      const incomingPoint = placementDropPoint;
      const isDirectManipulation = Boolean(
        (actorDrag?.phase === "dragging" &&
          actorDrag.actorIds.includes(actor.id)) ||
          (zoneActorTranslation &&
            actor.currentZoneId === zoneActorTranslation.zoneId)
      );
      const selected =
        !player && selection.selectedEntityType === "actor" &&
        selection.selectedIds.includes(actor.id);
      const colors = ACTOR_LAYOUT_GROUP_COLORS[actor.layoutGroup];
      const actorZone = encounter.zones.byId[actor.currentZoneId];
      const selectedActorTextColor = actorZone
        ? getZoneNameTextColor(
            actorZone,
            backgroundLuminanceByZoneId[actorZone.id]
          )
        : getTextColorForLuminance(canvasBackgroundLuminance);
      const surfaceContrast = readBackground
        ? createActorSurfaceContrast(renderedPoint, surfaceZones, readBackground)
        : undefined;
      const clipId = `${clipPrefix}${actor.id}-clip`;
      const actorTransition = getCanvasTransition(
        isDirectManipulation,
        animationsDisabled
      );
      return (
        <ActorMotionTrack
          key={actor.id}
          direct={isDirectManipulation}
          incomingPoint={incomingPoint}
          target={renderedPoint}
        >
          {(animatePoint, completeTrack) => (
            <ActorDragMotionGroup
              sceneMotionKey={actor.id}
              aria-label={name}
              className="cursor-grab select-none active:cursor-grabbing"
              data-entity-id={actor.id}
              data-entity-type="actor"
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
              drag={!player && ["actor", "select", "grid"].includes(activeToolId)}
              dragMomentum={false}
              dragElastic={0}
              dragOrigin={zoneMovedPoint}
              dragCallbacks={{
                onDragStart: event => onActorDragStart?.(actor.id, zoneMovedPoint, event),
                onDrag: onActorDrag,
                onDragEnd: event => onActorDragEnd?.(event)
              }}
              initial={false}
              animate={!player && isMotionDraggedActor ? undefined : animatePoint}
              transition={actorTransition}
              onAnimationComplete={() => {
                const completedMotion = completeTrack();

                if (
                  completedMotion === "track" &&
                  placementIncomingPoint
                ) {
                    if (!player) clearOptimisticActorPlacement(actor.id, placementIncomingPoint);
                  if (!player) onIncomingPointCommitted?.(actor.id);
                }

                if (
                  completedMotion &&
                  actorDrag?.phase === "returning" &&
                  actorDrag.actorIds.includes(actor.id) &&
                  (completedMotion === "track" ||
                    Boolean(actorDrag.returnPointsByActorId?.[actor.id]))
                ) {
                  if (!player) onActorReturnComplete?.(actor.id);
                }
              }}
            >
              <ActorTrim encounter={encounter} actor={actor} point={renderedPoint}>{artworkClipId => <ActorVisual showResourceBars showConditions
                hidden={!player && !!actorDrag?.hasMoved && actorDrag.phase !== "returning" && actorDrag.actorIds.includes(actor.id)}
                artworkClipId={artworkClipId}
                actor={actor} displayName={name}
                projectionRotation={projectionRotation} projectionAngle={encounter.grid.isometricAngle}
                clipId={clipId}
                fillColor={colors.fill}
                outlineColor={colors.outline}
                radius={radius}
                selected={selected}
                selectedTextColor={selectedActorTextColor}
                surfaceContrast={surfaceContrast}
                showFactionOutline={!player && showFactionOutlines}
                transition={actorTransition}
              />}
              </ActorTrim>
            </ActorDragMotionGroup>
          )}
        </ActorMotionTrack>
      );
    }
  )}</ActorOverlayLayers>;
}
