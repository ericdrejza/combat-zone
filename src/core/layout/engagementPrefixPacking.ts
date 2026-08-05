import type { EncounterState } from '@core/encounter/types';
import type {
  EngagementPackedActor,
  EngagementPackingResult
} from './engagementPacking';

/**
 * Reconstructs earlier membership prefixes, then validates the next state's
 * complete groups against those partition-preserving actor placements.
 */
export function tryEngagementPrefixPacking(
  encounter: EncounterState,
  packSeed: (seedEncounter: EncounterState) => EngagementPackingResult,
  packNext: (
    seedPlacements: readonly EngagementPackedActor[]
  ) => EngagementPackingResult
): EngagementPackingResult {
  for (const engagementId of encounter.engagements.allIds) {
    const engagement = encounter.engagements.byId[engagementId];
    if (!engagement || engagement.participantIds.length < 3) continue;
    const engagementCount = encounter.engagements.allIds.filter(
      (id) =>
        encounter.engagements.byId[id]?.parentZoneId === engagement.parentZoneId
    ).length;
    if (engagementCount < 2) continue;

    for (
      let prefixLength = engagement.participantIds.length - 1;
      prefixLength >= 2;
      prefixLength -= 1
    ) {
      const seedEncounter: EncounterState = {
        ...encounter,
        engagements: {
          ...encounter.engagements,
          byId: {
            ...encounter.engagements.byId,
            [engagementId]: {
              ...engagement,
              participantIds: engagement.participantIds.slice(0, prefixLength)
            }
          }
        }
      };
      const seed = packSeed(seedEncounter);
      if (!seed.fits) continue;
      const result = packNext(seed.placements);
      if (result.fits) return result;
    }
  }

  return {
    failureReason: 'space',
    fits: false,
    placements: [],
    tokenPoints: {}
  };
}
