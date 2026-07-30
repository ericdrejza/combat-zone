import type { EncounterState } from '@core/encounter/types';
import { getActorEngagement } from '@core/encounter/inspectors';

/** A drop onto the actor's existing group must never be interpreted as leave. */
export function isSameEngagementDrop(
  state: EncounterState,
  actorIds: readonly string[],
  targetEngagementId: string | undefined
): boolean {
  return Boolean(
    targetEngagementId &&
    actorIds.every(
      (actorId) => getActorEngagement(state, actorId)?.id === targetEngagementId
    )
  );
}
