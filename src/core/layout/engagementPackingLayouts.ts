import { getEngagementChainCandidateLayouts } from './engagementChainLayouts';
import { ENGAGEMENT_TOKEN_RADIUS } from './engagementGeometryConstants';
import { getEngagementParticipantCandidateLayouts } from './engagementPackingCandidates';
import type { LayoutPoint } from './types';

type Participant = {
  point: LayoutPoint;
  radius: number;
};

export type EngagementPackingLayout = {
  points: LayoutPoint[];
  searchWholePolygon?: boolean;
  token?: LayoutPoint;
};

function centerOf(points: readonly LayoutPoint[]): LayoutPoint {
  return points.reduce(
    (center, point) => ({
      x: center.x + point.x / points.length,
      y: center.y + point.y / points.length
    }),
    { x: 0, y: 0 }
  );
}

export function orderEngagementPackingCenters(
  centers: LayoutPoint[],
  polygon: readonly LayoutPoint[],
  preferBoundary: boolean
): LayoutPoint[] {
  if (!preferBoundary) return centers;
  const polygonCenter = centerOf(polygon);
  return centers.sort(
    (left, right) =>
      Math.hypot(right.x - polygonCenter.x, right.y - polygonCenter.y) -
        Math.hypot(left.x - polygonCenter.x, left.y - polygonCenter.y) ||
      left.y - right.y ||
      left.x - right.x
  );
}

function getParticipantScale(
  participants: readonly Participant[],
  clearance: number
): number {
  return participants.reduce(
    (requiredScale, participant, index) =>
      participants.slice(index + 1).reduce((scale, other) => {
        const distance = Math.hypot(
          participant.point.x - other.point.x,
          participant.point.y - other.point.y
        );
        const requiredDistance =
          participant.radius + other.radius + clearance;
        return distance > 0
          ? Math.max(scale, requiredDistance / distance)
          : scale;
      }, requiredScale),
    1
  );
}

/** Builds radial-first or chain-first candidates for one potential center. */
export function getEngagementPackingLayouts({
  center,
  clearance,
  members,
  orientation,
  originalCenter,
  preferChains,
  strategy,
  usesSplitSection
}: {
  center: LayoutPoint;
  clearance: number;
  members: readonly Participant[];
  orientation: 'LEFT_RIGHT' | 'TOP_BOTTOM';
  originalCenter: LayoutPoint;
  preferChains: boolean;
  strategy: 'FLEX' | 'SEQUENTIAL';
  usesSplitSection: boolean;
}): EngagementPackingLayout[] {
  const radial: EngagementPackingLayout[] =
    getEngagementParticipantCandidateLayouts(
      center,
      members.map(({ radius }) => radius),
      orientation,
      strategy,
      clearance,
      ENGAGEMENT_TOKEN_RADIUS
    ).map((points) => ({ points }));
  const chain = getEngagementChainCandidateLayouts(
    center,
    members.map(({ radius }) => radius),
    orientation,
    clearance
  );

  if (
    usesSplitSection &&
    center.x === originalCenter.x &&
    center.y === originalCenter.y
  ) {
    const scale = getParticipantScale(members, clearance);
    radial.push({
      points: members.map((member) => ({
        x: center.x + (member.point.x - originalCenter.x) * scale,
        y: center.y + (member.point.y - originalCenter.y) * scale
      })),
      searchWholePolygon: true
    });
  }

  const chained = chain.map(({ points, token }) => ({ points, token }));
  return preferChains ? [...chained, ...radial] : [...radial, ...chained];
}
