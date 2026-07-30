import {
  engagementClusterEnvelopesAreSeparate,
  type EngagementClusterEnvelope,
  footprintFitsPolygon
} from './engagementPackingCandidates';
import {
  hasCompleteEngagementConnectorNetwork,
  routeEngagementConnectors
} from './engagementConnectorRouting';
import type { LayoutPoint } from './types';
import type { ActorShape } from '@entities/actor/types';
import { engagementFootprintsAreSeparate } from './engagementFootprintGeometry';

type PackedFootprint = {
  actorId: string;
  point: LayoutPoint;
  radius: number;
  shape?: ActorShape;
};

function tokenIsClear(
  token: LayoutPoint,
  placements: readonly PackedFootprint[],
  tokens: readonly LayoutPoint[],
  minimumClearance: number,
  tokenRadius: number
): boolean {
  return placements.every((placement) =>
    engagementFootprintsAreSeparate(
      { point: token, radius: tokenRadius },
      placement,
      minimumClearance
    )
  ) && tokens.every((otherToken) =>
    engagementFootprintsAreSeparate(
      { point: token, radius: tokenRadius },
      { point: otherToken, radius: tokenRadius },
      minimumClearance
    )
  );
}

/** Applies every actor, token, and whole-cluster invariant to one candidate. */
export function engagementPackingCandidateFits({
  acceptedActors,
  acceptedClusters,
  acceptedTokens,
  actorClearance,
  minimumClearance,
  polygon,
  proposed,
  token,
  tokenRadius
}: {
  acceptedActors: readonly PackedFootprint[];
  acceptedClusters: readonly EngagementClusterEnvelope[];
  acceptedTokens: readonly LayoutPoint[];
  actorClearance: number;
  minimumClearance: number;
  polygon: readonly LayoutPoint[];
  proposed: readonly PackedFootprint[];
  token: LayoutPoint;
  tokenRadius: number;
}): boolean {
  const actorsFit = proposed.every((placement) =>
    footprintFitsPolygon(
      placement.point,
      placement.radius,
      polygon,
      minimumClearance,
      placement.shape
    ) &&
    acceptedActors.every((other) =>
      engagementFootprintsAreSeparate(
        placement,
        other,
        minimumClearance
      )
    ) &&
    proposed.every((other) =>
      other.actorId === placement.actorId ||
      engagementFootprintsAreSeparate(
        placement,
        other,
        actorClearance
      )
    )
  );
  const actorsClearTokens = proposed.every((placement) =>
    acceptedTokens.every((otherToken) =>
      engagementFootprintsAreSeparate(
        placement,
        { point: otherToken, radius: tokenRadius },
        minimumClearance
      )
    )
  );
  if (
    !actorsFit ||
    !actorsClearTokens ||
    !footprintFitsPolygon(token, tokenRadius, polygon, minimumClearance) ||
    !engagementClusterEnvelopesAreSeparate(
      { participants: proposed, token },
      acceptedClusters,
      minimumClearance
    ) ||
    !tokenIsClear(
      token,
      [...acceptedActors, ...proposed],
      acceptedTokens,
      minimumClearance,
      tokenRadius
    )
  ) {
    return false;
  }

  const connectors = routeEngagementConnectors(token, proposed, {
    obstacles: [
      ...acceptedActors,
      ...proposed,
      ...acceptedTokens.map((point, index) => ({
        actorId: `accepted-engagement-token:${index}`,
        point,
        radius: tokenRadius
      }))
    ]
  });

  return hasCompleteEngagementConnectorNetwork(proposed, connectors);
}
