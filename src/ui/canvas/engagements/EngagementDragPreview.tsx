import { motion } from 'motion/react';

import type { EncounterState } from '@core/encounter/types';
import type { ActorDragState } from '../canvasInteractionTypes';
import type { ActorRenderPlacement } from '../actors/actorCanvasLayout';
import { getEngagementTokenPoint } from './engagementGeometry';
import { isWithinEngagementTether } from './engagementDragRules';

/** Shows the 30px tether before an engaged actor visually disconnects. */
export function EngagementDragPreview({
  actorDrag,
  encounter,
  placements
}: {
  actorDrag: ActorDragState;
  encounter: EncounterState;
  placements: ActorRenderPlacement[];
}) {
  const actor = encounter.actors.byId[actorDrag.actorId];
  const engagement = encounter.engagements.allIds
    .map((id) => encounter.engagements.byId[id])
    .find((candidate) => candidate?.participantIds.includes(actorDrag.actorId));
  const zone = engagement ? encounter.zones.byId[engagement.parentZoneId] : undefined;
  const source = placements.find((placement) => placement.actor.id === actorDrag.actorId);
  if (!actor || !engagement || !zone || !source) return null;
  const byActorId = new Map(placements.map((placement) => [placement.actor.id, placement]));
  const participants = engagement.participantIds.flatMap((actorId) => {
    const placement = byActorId.get(actorId);
    return placement ? [{ actorId, point: placement.point, radius: placement.radius }] : [];
  });
  if (participants.length < 2) return null;
  const sectionPolygon = byActorId.get(
    engagement.participantIds[0]
  )?.sectionPolygon;
  const token = getEngagementTokenPoint(
    participants,
    sectionPolygon ?? zone.polygon
  );
  const dragged = {
    x: source.point.x + actorDrag.current.x - actorDrag.start.x,
    y: source.point.y + actorDrag.current.y - actorDrag.start.y
  };
  const tethered = isWithinEngagementTether(
    actorDrag.start,
    actorDrag.current
  );
  const endpoint = tethered ? dragged : token;
  return (
    <motion.line
      initial={false}
      animate={{ x1: token.x, x2: endpoint.x, y1: token.y, y2: endpoint.y }}
      stroke={zone.colorBorder}
      strokeLinecap="round"
      strokeWidth="2"
      transition={{ duration: 0.15 }}
    />
  );
}
