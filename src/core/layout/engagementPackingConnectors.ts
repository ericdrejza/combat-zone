import type { EncounterState } from '@core/encounter/types';
import { routeEngagementConnectorGroups } from './engagementConnectorRouting';
import type {
  EngagementPackedActor,
  EngagementPackingResult
} from './engagementPacking';

/** Audits the complete routed network after every group and actor is placed. */
export function engagementPackingHasCompleteConnectors(
  encounter: EncounterState,
  engagementIds: readonly string[],
  placements: readonly EngagementPackedActor[],
  tokenPoints: EngagementPackingResult['tokenPoints']
): boolean {
  const placementByActorId = new Map(
    placements.map((placement) => [placement.actorId, placement])
  );
  const groups = engagementIds.flatMap((engagementId) => {
    const engagement = encounter.engagements.byId[engagementId];
    const token = tokenPoints[engagementId];
    if (!engagement || !token) return [];
    const participants = engagement.participantIds.flatMap((actorId) => {
      const placement = placementByActorId.get(actorId);
      return placement ? [placement] : [];
    });
    return participants.length === engagement.participantIds.length
      ? [{ engagementId, participants, token }]
      : [];
  });

  return routeEngagementConnectorGroups(groups, placements).complete;
}
