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

export function getEngagementIdsByArea(
  encounter: EncounterState
): string[] {
  return encounter.engagements.allIds
    .map((engagementId, index) => {
      const engagement = encounter.engagements.byId[engagementId];
      const area =
        engagement?.participantIds.reduce((total, actorId) => {
          const actor = encounter.actors.byId[actorId];
          return total + (actor ? getActorFootprintArea(actor) : 0);
        }, Math.PI * ENGAGEMENT_TOKEN_RADIUS ** 2) ?? 0;

      return { area, engagementId, index };
    })
    .sort(
      (left, right) =>
        right.area - left.area || left.index - right.index
    )
    .map(({ engagementId }) => engagementId);
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

/**
 * Gives compound footprints first choice of constrained polygon space.
 * Collection order remains the stable tie-breaker so equal layouts do not
 * jitter between recalculations.
 */
export function orderActorsForEngagementPacking(
  encounter: EncounterState,
  actors: readonly Actor[]
): Actor[] {
  const actorById = new Map(actors.map((actor) => [actor.id, actor]));
  const sourceIndex = new Map(
    encounter.actors.allIds.map((actorId, index) => [actorId, index])
  );
  const assignedActorIds = new Set<string>();
  const groups = encounter.engagements.allIds.flatMap(
    (engagementId, engagementIndex) => {
      const engagement = encounter.engagements.byId[engagementId];
      const participants = engagement?.participantIds.flatMap((actorId) => {
        const actor = actorById.get(actorId);
        return actor ? [actor] : [];
      }) ?? [];

      if (participants.length < 2) {
        return [];
      }

      participants.forEach((actor) => assignedActorIds.add(actor.id));
      return [{
        engagementIndex,
        participants: participants.sort(
          (left, right) =>
            getActorFootprintArea(right) - getActorFootprintArea(left) ||
            (sourceIndex.get(left.id) ?? 0) - (sourceIndex.get(right.id) ?? 0)
        ),
        totalArea: participants.reduce(
          (total, actor) => total + getActorFootprintArea(actor),
          0
        )
      }];
    }
  );

  groups.sort(
    (left, right) =>
      right.totalArea - left.totalArea ||
      left.engagementIndex - right.engagementIndex
  );
  const unengagedActors = actors
    .filter((actor) => !assignedActorIds.has(actor.id))
    .sort(
      (left, right) =>
        getActorFootprintArea(right) - getActorFootprintArea(left) ||
        (sourceIndex.get(left.id) ?? 0) - (sourceIndex.get(right.id) ?? 0)
    );

  return [...groups.flatMap((group) => group.participants), ...unengagedActors];
}
