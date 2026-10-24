import { createPortal } from "react-dom";
import { motion } from "motion/react";

import type { EncounterState } from "@core/encounter/types";
import { ACTOR_LAYOUT_GROUP_COLORS } from "@entities/actor/actorVisuals";
import { useCanvasPreferences } from "@ui/canvas_preferences/useCanvasPreferences";
import type { ActorDragState } from "./canvasInteractionTypes";
import type { ActorRenderPlacement } from "./actors/actorCanvasLayout";
import { getTextColorForLuminance, getZoneNameTextColor } from "./canvasLuminance";
import { ActorVisual } from "./actors/ActorVisual";
import { ActorTrim } from "./actors/ActorTrim";
import { getDraggedPoint } from "./actors/actorDragPoint";
import { useActorBackgroundPixel } from './actors/ActorSurfaceProvider';
import { createActorSurfaceContrast } from './actors/actorSurfaceContrast';

type Props = {
  drag: ActorDragState | null;
  placements: ActorRenderPlacement[];
  canvas: SVGSVGElement | null;
  encounter: EncounterState;
  canvasLuminance: number;
  zoneLuminance: Record<string, number>;
  showFactionOutlines: boolean;
};

/** Keep live tokens above HTML panels without remounting their gestures. */
export function CanvasActorDragVisual({
  drag, placements, canvas, encounter, canvasLuminance, zoneLuminance, showFactionOutlines
}: Props) {
  const { preferences } = useCanvasPreferences();
  const readBackground = useActorBackgroundPixel();
  if (!drag?.hasMoved || drag.phase === "returning" || !canvas) return null;
  const bounds = canvas.getBoundingClientRect();

  return createPortal(
    <svg
      aria-hidden="true"
      data-actor-drag-visual
      className="pointer-events-none [&_*]:pointer-events-none fixed z-[90] overflow-visible"
      style={{ left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height }}
      viewBox={`0 0 ${encounter.canvasSize.width} ${encounter.canvasSize.height}`}
    >
      {placements.filter(p => drag.actorIds.includes(p.actor.id)).map(({ actor, point, radius }) => {
        const target = getDraggedPoint(actor.id, point, drag);
        const colors = ACTOR_LAYOUT_GROUP_COLORS[actor.layoutGroup];
        const zone = encounter.zones.byId[actor.currentZoneId];
        const selectedTextColor = zone
          ? getZoneNameTextColor(zone, zoneLuminance[zone.id])
          : getTextColorForLuminance(canvasLuminance);
        const surfaceContrast = readBackground
          ? createActorSurfaceContrast(target, encounter.zones, readBackground)
          : undefined;

        return (
          <motion.g key={actor.id} initial={false} animate={{ x: target.x, y: target.y }} transition={{ duration: 0 }}>
            <ActorTrim idPrefix="drag-actor-trim" actor={actor} encounter={encounter} point={target}>
              {artworkClipId => (
                <ActorVisual
                  actor={actor}
                  artworkClipId={artworkClipId}
                  clipId={`drag-visual-${actor.id}`}
                  fillColor={colors.fill}
                  outlineColor={colors.outline}
                  radius={radius}
                  selected
                  selectedTextColor={selectedTextColor}
                  surfaceContrast={surfaceContrast}
                  showFactionOutline={showFactionOutlines}
                  showResourceBars
                  showConditions
                  transition={{ duration: 0 }}
                  projectionRotation={encounter.grid.type === "isometric" && preferences.projectIsometricTokens
                    ? encounter.grid.rotation : undefined}
                  projectionAngle={encounter.grid.isometricAngle}
                />
              )}
            </ActorTrim>
          </motion.g>
        );
      })}
    </svg>,
    canvas.ownerDocument.body
  );
}
