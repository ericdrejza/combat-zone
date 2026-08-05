import type { EncounterState } from '@core/encounter/types';
import {
  type EngagementClusterEnvelope,
  getPolygonCandidates
} from './engagementPackingCandidates';
import {
  getEngagementPackingLayouts,
  orderEngagementPackingCenters
} from './engagementPackingLayouts';
import { engagementPackingCandidateFits } from './engagementPackingValidation';
import {
  getEngagementCountByZoneId,
  getEngagementPackingOrder
} from './engagementPackingOrder';
import {
  ENGAGEMENT_CHAIN_VISIBLE_CLEARANCE,
  ENGAGEMENT_MINIMUM_CLEARANCE,
  ENGAGEMENT_PREFERRED_CLEARANCE,
  ENGAGEMENT_SPACIOUS_CLEARANCES,
  ENGAGEMENT_TOKEN_RADIUS
} from './engagementGeometryConstants';
import {
  getEngagementTokenCandidates,
  getEngagementTokenPoint
} from './engagementTokenPlacement';
import { engagementPackingHasCompleteConnectors } from './engagementPackingConnectors';
import { packEngagementsWithJointSearch } from './engagementJointPacking';
import { tryEngagementPrefixPacking } from './engagementPrefixPacking';
import type {
  EngagementPackedActor,
  EngagementPackingResult
} from './engagementPackingTypes';
import {
  type EngagementFallbackLayout,
  tryEngagementPackingFallbacks
} from './engagementPackingFallback';
import { packLooseActor } from './engagementLooseActorPacking';
import type { LayoutPoint } from './types';

export {
  ENGAGEMENT_CHAIN_VISIBLE_CLEARANCE,
  ENGAGEMENT_MINIMUM_CLEARANCE,
  ENGAGEMENT_PREFERRED_CLEARANCE,
  ENGAGEMENT_TOKEN_RADIUS
};
export { getEngagementTokenPoint };
export type {
  EngagementPackedActor,
  EngagementPackingResult,
  EngagementParticipantPoint
} from './engagementPackingTypes';

function centerOf(points: readonly LayoutPoint[]): LayoutPoint {
  return points.reduce((result, point) => ({ x: result.x + point.x / points.length, y: result.y + point.y / points.length }), { x: 0, y: 0 });
}

/** Packs complete Engagement geometry while preserving the 4px invariant. */
export function packEngagementParticipants(
  encounter: EncounterState,
  placements: readonly EngagementPackedActor[],
  splitSectionPolygons: Readonly<Record<string, LayoutPoint[]>> = {},
  preferSpaciousFlex = true,
  preferChains = false,
  fallbackLayout?: EngagementFallbackLayout
): EngagementPackingResult {
  const output = placements.map((placement) => ({ ...placement, point: { ...placement.point } }));
  const byActorId = new Map(output.map((placement) => [placement.actorId, placement]));
  const engagementZoneIds = new Set(
    encounter.engagements.allIds.flatMap((engagementId) => {
      const engagement = encounter.engagements.byId[engagementId];
      return engagement ? [engagement.parentZoneId] : [];
    })
  );
  const acceptedActors: EngagementPackedActor[] = [];
  const acceptedClusters: EngagementClusterEnvelope[] = [];
  const acceptedTokens: LayoutPoint[] = [];
  const acceptedTokensByZoneId = new Map<string, LayoutPoint[]>();
  const tokenPoints: Record<string, LayoutPoint> = {};
  let fits = true;
  let failureReason: EngagementPackingResult['failureReason'];

  const engagementCountByZoneId = getEngagementCountByZoneId(encounter);
  const packingOrder = getEngagementPackingOrder(
    encounter,
    output.flatMap((placement) => {
      const actor = encounter.actors.byId[placement.actorId];
      return actor ? [actor] : [];
    })
  );
  const engagementIdsByArea = packingOrder.flatMap((item) =>
    item.kind === 'engagement' ? [item.engagementId] : []
  );

  for (const item of packingOrder) {
    if (item.kind === 'actor') {
      const placement = byActorId.get(item.actorId);
      if (!placement) continue;
      const acceptedPlacement = packLooseActor(
        encounter,
        placement,
        engagementZoneIds,
        acceptedActors,
        acceptedTokens
      );
      if (acceptedPlacement === null) {
        fits = false;
        failureReason = 'space';
      } else if (acceptedPlacement) {
        byActorId.set(item.actorId, acceptedPlacement);
        acceptedActors.push(acceptedPlacement);
      }
      continue;
    }

    const engagementId = item.engagementId;
    const engagement = encounter.engagements.byId[engagementId];
    const zone = engagement && encounter.zones.byId[engagement.parentZoneId];
    if (!engagement || !zone) continue;
    const sectionPolygon = splitSectionPolygons[
      `${zone.id}:engagement-${engagement.id}`
    ] ?? zone.polygon;
    const usesSplitSection = Boolean(
      splitSectionPolygons[`${zone.id}:engagement-${engagement.id}`]
    );
    const members = engagement.participantIds.flatMap((actorId) => {
      const placement = byActorId.get(actorId);
      return placement ? [placement] : [];
    });
    if (members.length < 2) continue;
    const originalCenter = centerOf(members.map((member) => member.point));
    const separatesFlexEngagements =
      zone.layoutStrategy === 'FLEX' &&
      !usesSplitSection &&
      (engagementCountByZoneId.get(zone.id) ?? 0) > 1;
    const zoneAcceptedTokens = acceptedTokensByZoneId.get(zone.id) ?? [];
    let accepted: EngagementPackedActor[] | undefined;
    let acceptedToken: LayoutPoint | undefined;
    const clearances =
      preferSpaciousFlex && zone.layoutStrategy === 'FLEX'
        ? ENGAGEMENT_SPACIOUS_CLEARANCES
        : [
            ENGAGEMENT_PREFERRED_CLEARANCE,
            ENGAGEMENT_MINIMUM_CLEARANCE
          ];
    for (const clearance of clearances) {
      const centers = fallbackLayout === 'preserved'
        ? [originalCenter]
        : orderEngagementPackingCenters(
            getPolygonCandidates(originalCenter, sectionPolygon, 16),
            sectionPolygon,
            preferChains && !fallbackLayout,
            separatesFlexEngagements ? zoneAcceptedTokens : []
          );
      for (const center of centers) {
        const candidateLayouts = getEngagementPackingLayouts({
          center,
          clearance,
          members,
          orientation: usesSplitSection
            ? zone.layoutOrientation === 'LEFT_RIGHT'
              ? 'TOP_BOTTOM'
              : 'LEFT_RIGHT'
            : engagement.layoutOrientation,
          originalCenter,
          onlyGrowthPlacement: fallbackLayout === 'growth',
          onlyPreservedInputPlacement: fallbackLayout === 'preserved',
          onlySwapPlacement: fallbackLayout === 'swap',
          polygon: sectionPolygon,
          preferChains,
          strategy: usesSplitSection
            ? 'SEQUENTIAL'
            : engagement.layoutStrategy,
          usesSplitSection
        });
        for (const layout of candidateLayouts) {
          const proposed = members.map((member, index) => ({
            ...member,
            point: layout.points[index]
          }));
          const tokenCandidates = layout.token
            ? [layout.token]
            : layout.searchWholePolygon
              ? getEngagementTokenCandidates(
                  proposed,
                  sectionPolygon,
                  true,
                  128
                )
              : [getEngagementTokenPoint(proposed, sectionPolygon, false)];
          for (const token of tokenCandidates) {
            if (engagementPackingCandidateFits({
              acceptedActors,
              acceptedClusters,
              acceptedTokens,
              actorClearance: clearance,
              minimumClearance: ENGAGEMENT_MINIMUM_CLEARANCE,
              polygon: sectionPolygon,
              proposed,
              token,
              tokenRadius: ENGAGEMENT_TOKEN_RADIUS
            })) {
              accepted = proposed;
              acceptedToken = token;
              break;
            }
          }
          if (accepted) break;
        }
        if (accepted) break;
      }
      if (accepted) break;
    }
    if (accepted && acceptedToken) {
      accepted.forEach((placement) => byActorId.set(placement.actorId, placement));
      acceptedActors.push(...accepted);
      acceptedClusters.push({ participants: accepted, token: acceptedToken });
      acceptedTokens.push(acceptedToken);
      acceptedTokensByZoneId.set(zone.id, [
        ...zoneAcceptedTokens,
        acceptedToken
      ]);
      tokenPoints[engagementId] = acceptedToken;
    } else {
      fits = false;
      failureReason = 'space';
    }
  }

  if (fits) {
    const connectorsComplete = engagementPackingHasCompleteConnectors(
      encounter,
      engagementIdsByArea,
      output.map((placement) => byActorId.get(placement.actorId) ?? placement),
      tokenPoints
    );
    if (!connectorsComplete) {
      fits = false;
      failureReason = 'connectors';
    }
  }

  if (!fits && preferSpaciousFlex && engagementZoneIds.size > 0) {
    // Wider clusters are only a preference: retry compactly so they can never
    // reduce the number of entities that fit in an otherwise valid zone.
    return packEngagementParticipants(
      encounter,
      placements,
      splitSectionPolygons,
      false,
      preferChains,
      fallbackLayout
    );
  }
  if (!fits && !preferChains && !fallbackLayout && engagementZoneIds.size > 0) {
    // A radial result can consume the space needed by a later group. Repack
    // every engagement with chain candidates first before rejecting growth.
    return packEngagementParticipants(
      encounter,
      placements,
      splitSectionPolygons,
      false,
      true
    );
  }
  if (!fits && !fallbackLayout && engagementZoneIds.size > 0) {
    return tryEngagementPackingFallbacks(
      (fallback) =>
        packEngagementParticipants(
          encounter,
          placements,
          splitSectionPolygons,
          false,
          true,
          fallback
        ),
      () => tryEngagementPrefixPacking(
        encounter,
        (seed) => packEngagementParticipants(
          seed, placements, splitSectionPolygons, false, false, 'seed'
        ),
        (seed) => packEngagementsWithJointSearch(
          encounter, seed, splitSectionPolygons
        )
      ),
      failureReason
    );
  }

  return {
    ...(failureReason ? { failureReason } : {}),
    fits,
    placements: output.map(
      (placement) => byActorId.get(placement.actorId) ?? placement
    ),
    tokenPoints
  };
}
