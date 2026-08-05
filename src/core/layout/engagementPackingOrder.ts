import type { EncounterState } from '@core/encounter/types';
import type { Actor } from '@entities/actor/types';
import { getActorRadius } from './actorFootprints';
import { ENGAGEMENT_TOKEN_RADIUS } from './engagementGeometryConstants';

export function getActorFootprintArea(actor: Actor): number {
  const radius = getActorRadius(actor);
  return actor.shape === 'rectangle'
    ? (radius * 2) ** 2
    : Math.PI * radius ** 2;
}

export function getEngagementCountByZoneId(
  encounter: EncounterState
): ReadonlyMap<string, number> {
  return encounter.engagements.allIds.reduce((counts, engagementId) => {
    const zoneId = encounter.engagements.byId[engagementId]?.parentZoneId;
    if (zoneId) counts.set(zoneId, (counts.get(zoneId) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());
}

export type EngagementPackingOrderItem =
  | {
      area: number;
      engagementId: string;
      kind: 'engagement';
      sourceIndex: number;
    }
  | { actorId: string; area: number; kind: 'actor'; sourceIndex: number };

/** Orders compound Engagements and standalone actors in one area-first queue. */
export function getEngagementPackingOrder(
  encounter: EncounterState,
  actors: readonly Actor[]
): EngagementPackingOrderItem[] {
  const actorById = new Map(actors.map((actor) => [actor.id, actor]));
  const assignedActorIds = new Set<string>();
  const engagementItems = encounter.engagements.allIds.flatMap(
    (engagementId, sourceIndex) => {
      const engagement = encounter.engagements.byId[engagementId];
      const participants = engagement?.participantIds.flatMap((actorId) => {
        const actor = actorById.get(actorId);
        return actor ? [actor] : [];
      }) ?? [];

      if (participants.length < 2) return [];
      participants.forEach(({ id }) => assignedActorIds.add(id));

      return [
        {
          area: participants.reduce(
            (total, actor) => total + getActorFootprintArea(actor),
            Math.PI * ENGAGEMENT_TOKEN_RADIUS ** 2
          ),
          engagementId,
          kind: 'engagement' as const,
          sourceIndex
        }
      ];
    }
  );
  const actorItems = actors.flatMap((actor, sourceIndex) =>
    assignedActorIds.has(actor.id)
      ? []
      : [
          {
            actorId: actor.id,
            area: getActorFootprintArea(actor),
            kind: 'actor' as const,
            sourceIndex
          }
        ]
  );

  return [...engagementItems, ...actorItems].sort(
    (left, right) =>
      right.area - left.area ||
      (left.kind === right.kind
        ? left.sourceIndex - right.sourceIndex
        : left.kind === 'engagement'
          ? -1
          : 1)
  );
}

/**
 * Gives the largest compound or standalone footprint first choice of space.
 * Collection order remains the tie-breaker so equal layouts do not jitter.
 */
export function orderActorsForEngagementPacking(
  encounter: EncounterState,
  actors: readonly Actor[]
): Actor[] {
  const actorById = new Map(actors.map((actor) => [actor.id, actor]));
  const sourceIndex = new Map(
    encounter.actors.allIds.map((actorId, index) => [actorId, index])
  );
  return getEngagementPackingOrder(encounter, actors).flatMap((item) => {
    if (item.kind === 'actor') {
      const actor = actorById.get(item.actorId);
      return actor ? [actor] : [];
    }

    const engagement = encounter.engagements.byId[item.engagementId];
    return (engagement?.participantIds.flatMap((actorId) => {
      const actor = actorById.get(actorId);
      return actor ? [actor] : [];
    }) ?? []).sort(
      (left, right) =>
        getActorFootprintArea(right) - getActorFootprintArea(left) ||
        (sourceIndex.get(left.id) ?? 0) - (sourceIndex.get(right.id) ?? 0)
    );
  });
}
