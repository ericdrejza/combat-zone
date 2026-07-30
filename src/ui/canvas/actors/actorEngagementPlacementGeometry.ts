import type { EncounterState } from '@core/encounter/types';
import { packEngagementParticipants } from '@core/layout/engagementPacking';
import type { LayoutPoint } from '@core/layout/types';
import type { ActorPlacementGeometry } from './actorPlacementCache';

/**
 * Keeps the packer's accepted token with each participant so later rendering,
 * routing, and hit-testing cannot derive a different settled geometry.
 */
export function attachEngagementPlacementGeometry(
  encounter: EncounterState,
  placements: readonly ActorPlacementGeometry[],
  splitSectionPolygons: Readonly<Record<string, LayoutPoint[]>>
): ActorPlacementGeometry[] {
  const packing = packEngagementParticipants(
    encounter,
    placements.map((placement) => ({
      ...placement,
      shape: encounter.actors.byId[placement.actorId]?.shape
    })),
    splitSectionPolygons
  );
  const tokenByActorId = new Map<string, LayoutPoint>();
  encounter.engagements.allIds.forEach((engagementId) => {
    const engagement = encounter.engagements.byId[engagementId];
    const token = packing.tokenPoints[engagementId];
    if (!engagement || !token) return;
    engagement.participantIds.forEach((actorId) =>
      tokenByActorId.set(actorId, token)
    );
  });

  return packing.placements.map((placement) => {
    const engagementTokenPoint = tokenByActorId.get(placement.actorId);
    return {
      ...placement,
      ...(engagementTokenPoint ? { engagementTokenPoint } : {})
    };
  });
}
