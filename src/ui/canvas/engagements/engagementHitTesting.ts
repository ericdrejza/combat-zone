import type { EncounterState } from '@core/encounter/types';
import type { LayoutPoint } from '@core/layout/types';
import type { ActorRenderPlacement } from '../actors/actorCanvasLayout';
import { ENGAGEMENT_TOKEN_RADIUS, getEngagementTokenPoint } from './engagementGeometry';

function within(point: LayoutPoint, target: LayoutPoint, radius: number): boolean {
  return Math.hypot(point.x - target.x, point.y - target.y) <= radius;
}

export function findActorIdAtPoint(
  placements: readonly ActorRenderPlacement[],
  point: LayoutPoint,
  excludedActorIds: readonly string[] = []
): string | undefined {
  const excluded = new Set(excludedActorIds);
  return placements.find((placement) =>
    !excluded.has(placement.actor.id) && within(point, placement.point, placement.radius)
  )?.actor.id;
}

export function findEngagementIdAtPoint(
  encounter: EncounterState,
  placements: readonly ActorRenderPlacement[],
  point: LayoutPoint
): string | undefined {
  const placementByActorId = new Map(placements.map((placement) => [placement.actor.id, placement]));
  return encounter.engagements.allIds.find((engagementId) => {
    const engagement = encounter.engagements.byId[engagementId];
    if (!engagement) return false;
    const participants = engagement.participantIds.flatMap((actorId) => {
      const placement = placementByActorId.get(actorId);
      return placement ? [{ actorId, point: placement.point, radius: placement.radius }] : [];
    });
    const zone = encounter.zones.byId[engagement.parentZoneId];
    const sectionPolygon = placementByActorId.get(
      engagement.participantIds[0]
    )?.sectionPolygon;
    const token =
      placementByActorId.get(engagement.participantIds[0])
        ?.engagementTokenPoint ??
      getEngagementTokenPoint(participants, sectionPolygon ?? zone?.polygon);
    return participants.length >= 2 && within(
      point,
      token,
      ENGAGEMENT_TOKEN_RADIUS + 4
    );
  });
}
