import { motion } from 'motion/react';

import type { EncounterState } from '@core/encounter/types';
import type { ActorDragState } from '../canvasInteractionTypes';
import type { ActorRenderPlacement } from '../actors/actorCanvasLayout';
import type { LayoutPoint } from '@core/layout/types';
import { getZoneEngagementColor } from '@entities/zone/zoneColors';
import { isWithinEngagementTether } from './engagementDragRules';

type PartialEngagementPreview = {
  actorId: string;
  color: string;
  draggedPoint: LayoutPoint;
  token: LayoutPoint;
};

/** Retracts every connector belonging to a dragged proper subset. */
export function EngagementDragPreview({
  actorDrag,
  encounter,
  placements
}: {
  actorDrag: ActorDragState;
  encounter: EncounterState;
  placements: ActorRenderPlacement[];
}) {
  const byActorId = new Map(
    placements.map((placement) => [placement.actor.id, placement])
  );
  const draggedIds = new Set(actorDrag.actorIds);
  const offset = {
    x: actorDrag.current.x - actorDrag.start.x,
    y: actorDrag.current.y - actorDrag.start.y
  };
  const previews = encounter.engagements.allIds.flatMap(
    (engagementId): PartialEngagementPreview[] => {
      const engagement = encounter.engagements.byId[engagementId];
      const zone = engagement
        ? encounter.zones.byId[engagement.parentZoneId]
        : undefined;
      const draggedParticipants =
        engagement?.participantIds.filter((actorId) =>
          draggedIds.has(actorId)
        ) ?? [];
      if (
        !engagement ||
        !zone ||
        draggedParticipants.length === 0 ||
        draggedParticipants.length === engagement.participantIds.length
      ) {
        return [];
      }
      const token = byActorId.get(
        engagement.participantIds[0]
      )?.engagementTokenPoint;
      if (!token) return [];

      return draggedParticipants.flatMap((actorId) => {
        const source = byActorId.get(actorId);
        return source
          ? [{
              actorId,
              color: getZoneEngagementColor(zone),
              draggedPoint: {
                x: source.point.x + offset.x,
                y: source.point.y + offset.y
              },
              token
            }]
          : [];
      });
    }
  );
  const tethered = isWithinEngagementTether(
    actorDrag.start,
    actorDrag.current
  );

  return (
    <>
      {previews.map(({ actorId, color, draggedPoint, token }) => {
        const endpoint = tethered ? draggedPoint : token;
        return (
          <motion.line
            key={actorId}
            animate={{
              x1: token.x,
              x2: endpoint.x,
              y1: token.y,
              y2: endpoint.y
            }}
            data-engagement-drag-preview={actorId}
            initial={false}
            stroke={color}
            strokeLinecap="round"
            strokeWidth="2"
            transition={{ duration: 0.15 }}
          />
        );
      })}
    </>
  );
}
