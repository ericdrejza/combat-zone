import type { ActorShape } from '@entities/actor/types';
import { getEngagementChainCandidateLayouts } from './engagementChainLayouts';
import {
  ENGAGEMENT_MINIMUM_CLEARANCE,
  ENGAGEMENT_TOKEN_RADIUS
} from './engagementGeometryConstants';
import {
  footprintFitsPolygon,
  getEngagementParticipantCandidateLayouts,
  getPolygonCandidates
} from './engagementPackingCandidates';
import type { EngagementPackingLayout } from './engagementPackingLayouts';
import { engagementFootprintsAreSeparate } from './engagementFootprintGeometry';
import { getEngagementTokenPoint } from './engagementTokenPlacement';
import type { LayoutPoint } from './types';

type GrowthMember = {
  point: LayoutPoint;
  radius: number;
  shape?: ActorShape;
};

function pointFits(
  member: GrowthMember,
  point: LayoutPoint,
  placed: readonly GrowthMember[],
  token: LayoutPoint,
  polygon: readonly LayoutPoint[],
  clearance: number
): boolean {
  const proposed = { ...member, point };

  return (
    footprintFitsPolygon(
      point,
      member.radius,
      polygon,
      ENGAGEMENT_MINIMUM_CLEARANCE,
      member.shape
    ) &&
    placed.every((other) =>
      engagementFootprintsAreSeparate(proposed, other, clearance)
    ) &&
    engagementFootprintsAreSeparate(
      proposed,
      { point: token, radius: ENGAGEMENT_TOKEN_RADIUS },
      ENGAGEMENT_MINIMUM_CLEARANCE
    )
  );
}

/**
 * Preserves a viable older Engagement prefix while placing later joiners in
 * remaining polygon space. Membership append order makes this reproducible
 * without persisting canvas coordinates or knowing the previous state.
 */
export function getEngagementGrowthLayouts({
  center,
  clearance,
  members,
  orientation,
  polygon,
  strategy
}: {
  center: LayoutPoint;
  clearance: number;
  members: readonly GrowthMember[];
  orientation: 'LEFT_RIGHT' | 'TOP_BOTTOM';
  polygon: readonly LayoutPoint[];
  strategy: 'FLEX' | 'SEQUENTIAL';
}): EngagementPackingLayout[] {
  const layouts: EngagementPackingLayout[] = [];

  for (let prefixLength = members.length - 1; prefixLength >= 2; prefixLength -= 1) {
    const prefix = members.slice(0, prefixLength);
    const radial: EngagementPackingLayout[] = getEngagementParticipantCandidateLayouts(
      center,
      prefix.map(({ radius }) => radius),
      orientation,
      strategy,
      clearance,
      ENGAGEMENT_TOKEN_RADIUS
    ).map((points) => ({ points }));
    const chains = getEngagementChainCandidateLayouts(
      center,
      prefix.map(({ radius }) => radius),
      orientation,
      clearance
    );

    for (const prefixLayout of [...radial, ...chains]) {
      const points = [...prefixLayout.points];
      const token = prefixLayout.token ?? getEngagementTokenPoint(
        prefix.map((member, index) => ({
          actorId: `growth-prefix-${index}`,
          point: points[index],
          radius: member.radius,
          shape: member.shape
        })),
        polygon,
        true
      );
      const placed = prefix.map((member, index) => ({
        ...member,
        point: points[index]
      }));
      let complete = true;

      for (const member of members.slice(prefixLength)) {
        const point = getPolygonCandidates(member.point, polygon, 16).find(
          (candidate) =>
            pointFits(member, candidate, placed, token, polygon, clearance)
        );
        if (!point) {
          complete = false;
          break;
        }
        points.push(point);
        placed.push({ ...member, point });
      }

      if (complete) layouts.push({ points, token });
    }
  }

  return layouts;
}
