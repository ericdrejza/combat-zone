import type { EncounterState } from '@core/encounter/types';
import {
  footprintFitsPolygon,
  getPolygonCandidates
} from './engagementPackingCandidates';
import {
  ENGAGEMENT_MINIMUM_CLEARANCE,
  ENGAGEMENT_PREFERRED_CLEARANCE,
  ENGAGEMENT_TOKEN_RADIUS
} from './engagementGeometryConstants';
import { engagementFootprintsAreSeparate } from './engagementFootprintGeometry';
import type { EngagementPackedActor } from './engagementPacking';
import type { LayoutPoint } from './types';

/** Places a standalone actor before smaller compound items can consume its space. */
export function packLooseActor(
  encounter: EncounterState,
  placement: EngagementPackedActor,
  engagementZoneIds: ReadonlySet<string>,
  acceptedActors: readonly EngagementPackedActor[],
  acceptedTokens: readonly LayoutPoint[]
): EngagementPackedActor | null | undefined {
  const actor = encounter.actors.byId[placement.actorId];
  const zone = actor && encounter.zones.byId[actor.currentZoneId];
  const polygon = placement.sectionPolygon ?? zone?.polygon;

  if (!actor || !engagementZoneIds.has(actor.currentZoneId) || !polygon) {
    return undefined;
  }

  for (const clearance of [
    ENGAGEMENT_PREFERRED_CLEARANCE,
    ENGAGEMENT_MINIMUM_CLEARANCE
  ]) {
    const pointFits = (point: LayoutPoint) =>
      footprintFitsPolygon(
        point,
        placement.radius,
        polygon,
        ENGAGEMENT_MINIMUM_CLEARANCE,
        placement.shape
      ) &&
      acceptedActors.every((other) =>
        engagementFootprintsAreSeparate(
          { ...placement, point },
          other,
          clearance
        )
      ) &&
      acceptedTokens.every((token) =>
        engagementFootprintsAreSeparate(
          { ...placement, point },
          { point: token, radius: ENGAGEMENT_TOKEN_RADIUS },
          clearance
        )
      );
    const acceptedPoint = pointFits(placement.point)
      ? placement.point
      : getPolygonCandidates(
          placement.point,
          polygon,
          Math.max(12, Math.min(20, placement.radius))
        ).find(pointFits);

    if (acceptedPoint) return { ...placement, point: acceptedPoint };
  }

  return null;
}
