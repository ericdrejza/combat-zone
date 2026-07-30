import { getEngagementChainCandidateLayouts } from './engagementChainLayouts';
import { ENGAGEMENT_TOKEN_RADIUS } from './engagementGeometryConstants';
import { getEngagementParticipantCandidateLayouts } from './engagementPackingCandidates';
import { distanceToPolygonBoundary } from './polygonGeometry';
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
  preferBoundary: boolean,
  avoidPoints: readonly LayoutPoint[] = []
): LayoutPoint[] {
  if (!preferBoundary && avoidPoints.length === 0) return centers;
  const polygonCenter = centerOf(polygon);
  const scored = centers.map((point) => {
    const boundaryDistance = distanceToPolygonBoundary(point, polygon);
    const avoidDistance =
      avoidPoints.length > 0
        ? Math.min(
            ...avoidPoints.map((other) =>
              Math.hypot(point.x - other.x, point.y - other.y)
            )
          )
        : 0;
    return {
      boundaryDistance,
      point,
      regionScore:
        avoidPoints.length > 0
          ? Math.min(avoidDistance, boundaryDistance)
          : 0
    };
  });

  return scored.sort(
    (left, right) =>
      right.regionScore - left.regionScore ||
      (preferBoundary
        ? left.boundaryDistance - right.boundaryDistance
        : right.boundaryDistance - left.boundaryDistance) ||
      Math.hypot(right.point.x - polygonCenter.x, right.point.y - polygonCenter.y) -
        Math.hypot(left.point.x - polygonCenter.x, left.point.y - polygonCenter.y) ||
      left.point.y - right.point.y ||
      left.point.x - right.point.x
  ).map(({ point }) => point);
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
