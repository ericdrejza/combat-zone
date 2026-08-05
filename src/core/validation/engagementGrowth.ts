import type { EncounterState } from '../encounter/types';

/** Detects Engagement growth even when every participant was already in-zone. */
export function didZoneGainEngagementMembership(
  state: EncounterState,
  nextState: EncounterState,
  zoneId: string
): boolean {
  const previousMemberships = new Set(
    state.engagements.allIds.flatMap((engagementId) => {
      const engagement = state.engagements.byId[engagementId];

      return engagement?.parentZoneId === zoneId
        ? engagement.participantIds.map(
            (actorId) => `${engagementId}:${actorId}`
          )
        : [];
    })
  );

  return nextState.engagements.allIds.some((engagementId) => {
    const engagement = nextState.engagements.byId[engagementId];

    return Boolean(
      engagement?.parentZoneId === zoneId &&
        engagement.participantIds.some(
          (actorId) => !previousMemberships.has(`${engagementId}:${actorId}`)
        )
    );
  });
}
