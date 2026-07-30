import type { EncounterState } from '@core/encounter/types';
import type { ActorShape } from '@entities/actor/types';
import {
  type EngagementClusterEnvelope,
  footprintFitsPolygon,
  getPolygonCandidates
} from './engagementPackingCandidates';
import {
  getEngagementPackingLayouts,
  orderEngagementPackingCenters
} from './engagementPackingLayouts';
import { engagementPackingCandidateFits } from './engagementPackingValidation';
import {
  getEngagementCountByZoneId,
  getEngagementIdsByArea
} from './engagementPackingOrder';
import {
  ENGAGEMENT_CHAIN_VISIBLE_CLEARANCE,
  ENGAGEMENT_MINIMUM_CLEARANCE,
  ENGAGEMENT_PREFERRED_CLEARANCE,
  ENGAGEMENT_SPACIOUS_CLEARANCES,
  ENGAGEMENT_TOKEN_RADIUS
} from './engagementGeometryConstants';
import { getEngagementTokenPoint } from './engagementTokenPlacement';
import { engagementFootprintsAreSeparate } from './engagementFootprintGeometry';
import { engagementPackingHasCompleteConnectors } from './engagementPackingConnectors';
import type { LayoutPoint } from './types';

export type EngagementPackedActor = {
  actorId: string;
  point: LayoutPoint;
  radius: number;
  sectionPolygon?: LayoutPoint[];
  shape?: ActorShape;
};

export {
  ENGAGEMENT_CHAIN_VISIBLE_CLEARANCE,
  ENGAGEMENT_MINIMUM_CLEARANCE,
  ENGAGEMENT_PREFERRED_CLEARANCE,
  ENGAGEMENT_TOKEN_RADIUS
};
export { getEngagementTokenPoint };

export type EngagementParticipantPoint = {
  actorId: string;
  point: LayoutPoint;
  radius: number;
  shape?: ActorShape;
};

export type EngagementPackingResult = {
  failureReason?: 'connectors' | 'space';
  fits: boolean;
  placements: EngagementPackedActor[];
  tokenPoints: Readonly<Record<string, LayoutPoint>>;
};

function centerOf(points: readonly LayoutPoint[]): LayoutPoint {
  return points.reduce((result, point) => ({ x: result.x + point.x / points.length, y: result.y + point.y / points.length }), { x: 0, y: 0 });
}

/** Packs complete Engagement geometry while preserving the 2px invariant. */
export function packEngagementParticipants(
  encounter: EncounterState,
  placements: readonly EngagementPackedActor[],
  splitSectionPolygons: Readonly<Record<string, LayoutPoint[]>> = {},
  preferSpaciousFlex = true,
  preferChains = false
): EngagementPackingResult {
  const output = placements.map((placement) => ({ ...placement, point: { ...placement.point } }));
  const byActorId = new Map(output.map((placement) => [placement.actorId, placement]));
  const engagedActorIds = new Set(
    encounter.engagements.allIds.flatMap(
      (engagementId) =>
        encounter.engagements.byId[engagementId]?.participantIds ?? []
    )
  );
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

  const engagementIdsByArea = getEngagementIdsByArea(encounter);
  const engagementCountByZoneId = getEngagementCountByZoneId(encounter);

  for (const engagementId of engagementIdsByArea) {
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
            ENGAGEMENT_CHAIN_VISIBLE_CLEARANCE,
            ENGAGEMENT_MINIMUM_CLEARANCE
          ];
    for (const clearance of clearances) {
      const centers = orderEngagementPackingCenters(
        getPolygonCandidates(originalCenter, sectionPolygon, 16),
        sectionPolygon,
        preferChains,
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
          const token =
            layout.token ??
            getEngagementTokenPoint(
              proposed,
              sectionPolygon,
              layout.searchWholePolygon
            );
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

  for (const placement of output) {
    if (engagedActorIds.has(placement.actorId)) continue;
    const actor = encounter.actors.byId[placement.actorId];
    const zone = actor && encounter.zones.byId[actor.currentZoneId];
    const polygon = placement.sectionPolygon ?? zone?.polygon;
    if (!actor || !engagementZoneIds.has(actor.currentZoneId) || !polygon) {
      continue;
    }
    let acceptedPoint: LayoutPoint | undefined;

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
      acceptedPoint = pointFits(placement.point)
        ? placement.point
        : getPolygonCandidates(
            placement.point,
            polygon,
            Math.max(12, Math.min(20, placement.radius))
          ).find(pointFits);
      if (acceptedPoint) break;
    }

    if (!acceptedPoint) {
      fits = false;
      failureReason = 'space';
      continue;
    }
    const acceptedPlacement = { ...placement, point: acceptedPoint };
    byActorId.set(placement.actorId, acceptedPlacement);
    acceptedActors.push(acceptedPlacement);
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
      preferChains
    );
  }
  if (!fits && !preferChains && engagementZoneIds.size > 0) {
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

  return {
    ...(failureReason ? { failureReason } : {}),
    fits,
    placements: output.map(
      (placement) => byActorId.get(placement.actorId) ?? placement
    ),
    tokenPoints
  };
}
