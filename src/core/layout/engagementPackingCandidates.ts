import type { LayoutPoint } from './types';
import {
  distanceToPolygonBoundary,
  isFootprintInsideZone,
  isPointInPolygon
} from './polygonGeometry';
import type { ActorShape } from '@entities/actor/types';

const DISTANCE_EPSILON = 0.01;

type ClusterParticipant = {
  point: LayoutPoint;
};

export type EngagementClusterEnvelope = {
  participants: readonly ClusterParticipant[];
  token: LayoutPoint;
};

/**
 * Keeps every participant on its own token's side of the two-token boundary.
 * This prevents nesting without reserving a wasteful circle around an
 * elongated chain.
 */
export function engagementClusterEnvelopesAreSeparate(
  candidate: EngagementClusterEnvelope,
  accepted: readonly EngagementClusterEnvelope[],
  clearance: number
): boolean {
  const belongsToToken = (
    participant: ClusterParticipant,
    ownToken: LayoutPoint,
    otherToken: LayoutPoint
  ) =>
    Math.hypot(
      participant.point.x - ownToken.x,
      participant.point.y - ownToken.y
    ) +
      clearance <=
    Math.hypot(
      participant.point.x - otherToken.x,
      participant.point.y - otherToken.y
    );

  return accepted.every(
    (other) =>
      candidate.participants.every((participant) =>
        belongsToToken(participant, candidate.token, other.token)
      ) &&
      other.participants.every((participant) =>
        belongsToToken(participant, other.token, candidate.token)
      )
  );
}

export function footprintFitsPolygon(
  point: LayoutPoint,
  radius: number,
  polygon: readonly LayoutPoint[],
  boundaryClearance = 0,
  shape: ActorShape = 'circle'
): boolean {
  if (shape === 'rectangle') {
    const extent = radius + boundaryClearance;
    return isFootprintInsideZone(
      [
        { x: point.x - extent, y: point.y - extent },
        { x: point.x + extent, y: point.y - extent },
        { x: point.x + extent, y: point.y + extent },
        { x: point.x - extent, y: point.y + extent }
      ],
      [...polygon]
    );
  }
  return (
    isPointInPolygon(point, polygon) &&
    distanceToPolygonBoundary(point, polygon) + DISTANCE_EPSILON >=
      radius + boundaryClearance
  );
}

/** Returns a stable nearest-first search grid covering the whole polygon. */
export function getPolygonCandidates(
  preferred: LayoutPoint,
  polygon: readonly LayoutPoint[],
  step: number
): LayoutPoint[] {
  const minX = Math.min(...polygon.map(({ x }) => x));
  const maxX = Math.max(...polygon.map(({ x }) => x));
  const minY = Math.min(...polygon.map(({ y }) => y));
  const maxY = Math.max(...polygon.map(({ y }) => y));
  const candidates = [
    preferred,
    { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
    polygon.reduce(
      (center, point) => ({
        x: center.x + point.x / polygon.length,
        y: center.y + point.y / polygon.length
      }),
      { x: 0, y: 0 }
    )
  ];

  for (let y = minY; y <= maxY; y += step) {
    for (let x = minX; x <= maxX; x += step) {
      candidates.push({ x, y });
    }
  }

  const uniqueCandidates = Array.from(
    new Map(
      candidates.map((point) => [`${point.x}:${point.y}`, point])
    ).values()
  );

  return uniqueCandidates.filter((point) =>
    isPointInPolygon(point, polygon)
  ).sort(
    (left, right) =>
      Math.hypot(left.x - preferred.x, left.y - preferred.y) -
      Math.hypot(right.x - preferred.x, right.y - preferred.y) ||
      left.y - right.y ||
      left.x - right.x
  );
}

function getRingCounts(participantCount: number, ringCount: number): number[] {
  const weights = Array.from(
    { length: ringCount },
    (_, index) => index * 2 + 1
  );
  const weightTotal = weights.reduce((total, weight) => total + weight, 0);
  const counts = weights.map((weight) =>
    Math.max(2, Math.floor((participantCount * weight) / weightTotal))
  );
  let assigned = counts.reduce((total, count) => total + count, 0);

  while (assigned > participantCount) {
    const index = counts.findIndex((count) => count > 2);
    if (index < 0) break;
    counts[index] -= 1;
    assigned -= 1;
  }
  while (assigned < participantCount) {
    counts[counts.length - 1] += 1;
    assigned += 1;
  }

  return counts;
}

function getFlexRingLayout(
  center: LayoutPoint,
  radii: readonly number[],
  baseAngle: number,
  clearance: number,
  tokenRadius: number,
  ringCount: number
): LayoutPoint[] {
  const counts = getRingCounts(radii.length, ringCount);
  const points: LayoutPoint[] = [];
  let previousRingRadius = 0;
  let previousLargestRadius = 0;
  let participantOffset = 0;

  counts.forEach((count, ringIndex) => {
    const ringRadii = radii.slice(participantOffset, participantOffset + count);
    const largestRadius = Math.max(...ringRadii);
    const minimumActorDistance =
      largestRadius * 2 + clearance + DISTANCE_EPSILON;
    const chordRadius =
      minimumActorDistance / (2 * Math.sin(Math.PI / count));
    const ringRadius = Math.max(
      chordRadius,
      ringIndex === 0
        ? largestRadius + tokenRadius + clearance + DISTANCE_EPSILON
        : previousRingRadius +
          previousLargestRadius +
          largestRadius +
          clearance +
          DISTANCE_EPSILON
    );
    const angleOffset =
      baseAngle + (ringIndex % 2 === 0 ? 0 : Math.PI / count);

    for (let index = 0; index < count; index += 1) {
      const angle = angleOffset + (Math.PI * 2 * index) / count;
      points.push({
        x: center.x + Math.cos(angle) * ringRadius,
        y: center.y + Math.sin(angle) * ringRadius
      });
    }
    previousRingRadius = ringRadius;
    previousLargestRadius = largestRadius;
    participantOffset += count;
  });

  return points;
}

/**
 * Returns increasingly compact cluster shapes. Concentric rings let
 * membership grow with available zone area instead of one ring's diameter.
 */
export function getEngagementParticipantCandidateLayouts(
  center: LayoutPoint,
  radii: readonly number[],
  orientation: 'LEFT_RIGHT' | 'TOP_BOTTOM',
  strategy: 'FLEX' | 'SEQUENTIAL',
  clearance: number,
  tokenRadius: number
): LayoutPoint[][] {
  const baseAngle = orientation === 'LEFT_RIGHT' ? 0 : -Math.PI / 2;
  const largest = Math.max(...radii);

  if (strategy === 'SEQUENTIAL') {
    let positiveDistance =
      largest + tokenRadius + clearance + DISTANCE_EPSILON;
    let negativeDistance = positiveDistance;

    return [radii.map((radius, index) => {
      const positive = index % 2 === 0;
      const priorIndex = index - 2;
      const previousRadius = priorIndex >= 0 ? radii[priorIndex] : radius;
      const distance = positive ? positiveDistance : negativeDistance;
      const nextDistance =
        distance +
        radius +
        previousRadius +
        clearance +
        DISTANCE_EPSILON;

      if (positive) positiveDistance = nextDistance;
      else negativeDistance = nextDistance;
      const signedDistance = positive ? distance : -distance;
      return {
        x: center.x + Math.cos(baseAngle) * signedDistance,
        y: center.y + Math.sin(baseAngle) * signedDistance
      };
    })];
  }

  const maximumRingCount = Math.max(
    1,
    Math.min(Math.floor(radii.length / 2), Math.ceil(Math.sqrt(radii.length)))
  );
  // Half-step rotation lets mixed-size rings use polygon corners instead of
  // rejecting a fit solely because the largest actor is axis-aligned.
  const baseAngles = [baseAngle, baseAngle + Math.PI / radii.length];

  return Array.from({ length: maximumRingCount }, (_, index) =>
    baseAngles.map((candidateBaseAngle) =>
      getFlexRingLayout(
        center,
        radii,
        candidateBaseAngle,
        clearance,
        tokenRadius,
        index + 1
      )
    )
  ).flat();
}
