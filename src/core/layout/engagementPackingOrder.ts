import type { EncounterState } from '@core/encounter/types';
import type { Actor } from '@entities/actor/types';
import { getActorRadius } from './actorFootprints';

export function getActorFootprintArea(actor: Actor): number {
  const radius = getActorRadius(actor);
  return actor.shape === 'rectangle'
    ? (radius * 2) ** 2
    : Math.PI * radius ** 2;
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
