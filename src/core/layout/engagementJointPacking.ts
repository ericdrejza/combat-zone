import type { EncounterState } from '@core/encounter/types';
import {
  ENGAGEMENT_MINIMUM_CLEARANCE,
  ENGAGEMENT_TOKEN_RADIUS
} from './engagementGeometryConstants';
import { engagementPackingHasCompleteConnectors } from './engagementPackingConnectors';
import {
  getPolygonCandidates,
  type EngagementClusterEnvelope
} from './engagementPackingCandidates';
import {
  getEngagementPackingLayouts,
  orderEngagementPackingCenters
} from './engagementPackingLayouts';
import type {
  EngagementPackedActor,
  EngagementPackingResult
} from './engagementPackingTypes';
import { engagementPackingCandidateFits } from './engagementPackingValidation';
import { getEngagementPackingOrder } from './engagementPackingOrder';
import { getEngagementTokenCandidates } from './engagementTokenPlacement';
import type { LayoutPoint } from './types';

const MAX_JOINT_PACKING_STATES = 3_000;
const MAX_CENTERS_PER_GROUP = 32;
const MAX_TOKENS_PER_LAYOUT = 32;

function centerOf(points: readonly LayoutPoint[]): LayoutPoint {
  return points.reduce(
    (center, point) => ({
      x: center.x + point.x / points.length,
      y: center.y + point.y / points.length
    }),
    { x: 0, y: 0 }
  );
}

/** Backtracks compact group layouts and tokens around preserved partitions. */
export function packEngagementsWithJointSearch(
  encounter: EncounterState,
  placements: readonly EngagementPackedActor[],
  splitSectionPolygons: Readonly<Record<string, LayoutPoint[]>>
): EngagementPackingResult {
  const byActorId = new Map(
    placements.map((placement) => [placement.actorId, placement])
  );
  const packingOrder = getEngagementPackingOrder(
    encounter,
    placements.flatMap((placement) => {
      const actor = encounter.actors.byId[placement.actorId];
      return actor ? [actor] : [];
    })
  );
  const engagementIds = packingOrder.flatMap((item) =>
    item.kind === 'engagement' ? [item.engagementId] : []
  );
  const engagedActorIds = new Set(
    engagementIds.flatMap(
      (id) => encounter.engagements.byId[id]?.participantIds ?? []
    )
  );
  const looseActors = placements.filter(
    ({ actorId }) => !engagedActorIds.has(actorId)
  );
  let searchedStates = 0;

  const search = (
    index: number,
    acceptedActors: EngagementPackedActor[],
    acceptedClusters: EngagementClusterEnvelope[],
    acceptedTokens: LayoutPoint[],
    settled: Map<string, EngagementPackedActor>,
    tokenPoints: Record<string, LayoutPoint>
  ): {
    settled: Map<string, EngagementPackedActor>;
    tokenPoints: Record<string, LayoutPoint>;
  } | undefined => {
    if (searchedStates >= MAX_JOINT_PACKING_STATES) return undefined;
    if (index >= engagementIds.length) {
      const settledPlacements = placements.map(
        (placement) => settled.get(placement.actorId) ?? placement
      );
      return engagementPackingHasCompleteConnectors(
        encounter,
        engagementIds,
        settledPlacements,
        tokenPoints
      ) ? { settled, tokenPoints } : undefined;
    }

    const engagementId = engagementIds[index];
    const engagement = encounter.engagements.byId[engagementId];
    const zone = engagement && encounter.zones.byId[engagement.parentZoneId];
    if (!engagement || !zone) return undefined;
    const members = engagement.participantIds.flatMap((actorId) => {
      const placement = byActorId.get(actorId);
      return placement ? [placement] : [];
    });
    if (members.length !== engagement.participantIds.length) return undefined;
    const sectionKey = `${zone.id}:engagement-${engagement.id}`;
    const polygon = splitSectionPolygons[sectionKey] ?? zone.polygon;
    const usesSplitSection = Boolean(splitSectionPolygons[sectionKey]);
    const originalCenter = centerOf(members.map(({ point }) => point));
    const orderedCenters = orderEngagementPackingCenters(
      getPolygonCandidates(originalCenter, polygon, 16),
      polygon,
      false,
      acceptedTokens
    );
    const centers = [
      originalCenter,
      ...orderedCenters.filter(
        (point) =>
          point.x !== originalCenter.x || point.y !== originalCenter.y
      )
    ].slice(0, MAX_CENTERS_PER_GROUP);
    const orientation = usesSplitSection
      ? zone.layoutOrientation === 'LEFT_RIGHT'
        ? 'TOP_BOTTOM'
        : 'LEFT_RIGHT'
      : engagement.layoutOrientation;
    const strategy = usesSplitSection
      ? 'SEQUENTIAL'
      : engagement.layoutStrategy;

    for (const center of centers) {
      for (const fallback of [undefined, 'preserved'] as const) {
        if (fallback === 'preserved' && center !== originalCenter) continue;
        const layouts = getEngagementPackingLayouts({
          center,
          clearance: ENGAGEMENT_MINIMUM_CLEARANCE,
          members,
          orientation,
          originalCenter,
          onlyGrowthPlacement: false,
          onlyPreservedInputPlacement: fallback === 'preserved',
          onlySwapPlacement: false,
          polygon,
          preferChains: false,
          strategy,
          usesSplitSection
        });

        for (const layout of layouts) {
          const proposed = members.map((member, memberIndex) => ({
            ...member,
            point: layout.points[memberIndex]
          }));
          const tokens = layout.token
            ? [layout.token]
            : getEngagementTokenCandidates(
                proposed,
                polygon,
                true,
                MAX_TOKENS_PER_LAYOUT
              );

          for (const token of tokens) {
            searchedStates += 1;
            if (!engagementPackingCandidateFits({
              acceptedActors,
              acceptedClusters,
              acceptedTokens,
              actorClearance: ENGAGEMENT_MINIMUM_CLEARANCE,
              minimumClearance: ENGAGEMENT_MINIMUM_CLEARANCE,
              polygon,
              proposed,
              token,
              tokenRadius: ENGAGEMENT_TOKEN_RADIUS
            })) continue;
            const nextSettled = new Map(settled);
            proposed.forEach((placement) =>
              nextSettled.set(placement.actorId, placement)
            );
            const result = search(
              index + 1,
              [...acceptedActors, ...proposed],
              [...acceptedClusters, { participants: proposed, token }],
              [...acceptedTokens, token],
              nextSettled,
              { ...tokenPoints, [engagementId]: token }
            );
            if (result) return result;
          }
        }
      }
    }
    return undefined;
  };

  const result = search(0, [...looseActors], [], [], new Map(), {});
  return {
    ...(result ? {} : { failureReason: 'space' as const }),
    fits: Boolean(result),
    placements: placements.map(
      (placement) => result?.settled.get(placement.actorId) ?? placement
    ),
    tokenPoints: result?.tokenPoints ?? {}
  };
}
