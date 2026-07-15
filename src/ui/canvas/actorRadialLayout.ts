import type { LayoutPoint } from '@core/layout/types';
import type { Actor } from '@entities/actor/types';

export const RADIAL_ACTOR_GAP = 8;
export const RADIAL_START_ANGLE = -Math.PI / 2;

export type RadialActorPlacementInput = {
  actor: Actor;
  radius: number;
};

type RadialRing = {
  actorStartIndex: number;
  actorCount: number;
  radius: number;
};

function getPointOnRing(
  center: LayoutPoint,
  ringRadius: number,
  angle: number
): LayoutPoint {
  return {
    x: center.x + Math.cos(angle) * ringRadius,
    y: center.y + Math.sin(angle) * ringRadius
  };
}

function getRingCapacity(ringRadius: number, actorSpacing: number): number {
  if (ringRadius <= 0) {
    return 1;
  }

  return Math.max(1, Math.floor((Math.PI * 2 * ringRadius) / actorSpacing));
}

function getSequentialAngleStep(
  ringRadius: number,
  actorSpacing: number
): number {
  if (ringRadius <= 0) {
    return Math.PI * 2;
  }

  const chordRatio = Math.min(1, actorSpacing / (2 * ringRadius));

  return Math.max(2 * Math.asin(chordRatio), Math.PI / 24);
}

function buildRadialRings(
  actorCount: number,
  outerRadius: number,
  actorSpacing: number
): RadialRing[] {
  const rings: RadialRing[] = [];
  let remaining = actorCount;
  let actorStartIndex = 0;
  let ringRadius = Math.max(0, outerRadius);

  while (remaining > 0) {
    const actorCountInRing = Math.min(
      remaining,
      getRingCapacity(ringRadius, actorSpacing)
    );

    rings.push({
      actorCount: actorCountInRing,
      actorStartIndex,
      radius: ringRadius
    });

    remaining -= actorCountInRing;
    actorStartIndex += actorCountInRing;
    ringRadius = Math.max(0, ringRadius - actorSpacing);

    if (ringRadius === 0 && remaining > 0) {
      rings.push({
        actorCount: remaining,
        actorStartIndex,
        radius: 0
      });
      break;
    }
  }

  return rings;
}

export function getFlexRadialActorPoints(
  actors: RadialActorPlacementInput[],
  center: LayoutPoint,
  zoneRadius: number
): LayoutPoint[] {
  if (actors.length === 0) {
    return [];
  }

  if (actors.length === 1) {
    return [center];
  }

  const maxActorRadius = Math.max(...actors.map((actor) => actor.radius));
  const actorSpacing = maxActorRadius * 2 + RADIAL_ACTOR_GAP;
  const outerRadius = zoneRadius - maxActorRadius - RADIAL_ACTOR_GAP;
  const rings = buildRadialRings(actors.length, outerRadius, actorSpacing);
  const points: LayoutPoint[] = [];

  for (const ring of rings) {
    for (let index = 0; index < ring.actorCount; index += 1) {
      const angle =
        RADIAL_START_ANGLE + (index / ring.actorCount) * Math.PI * 2;
      points[ring.actorStartIndex + index] = getPointOnRing(
        center,
        ring.radius,
        angle
      );
    }
  }

  return points;
}

export function getSequentialRadialActorPoints(
  actors: RadialActorPlacementInput[],
  center: LayoutPoint,
  zoneRadius: number
): LayoutPoint[] {
  if (actors.length === 0) {
    return [];
  }

  const maxActorRadius = Math.max(...actors.map((actor) => actor.radius));
  const actorSpacing = maxActorRadius * 2 + RADIAL_ACTOR_GAP;
  const outerRadius = zoneRadius - maxActorRadius - RADIAL_ACTOR_GAP;
  const rings = buildRadialRings(actors.length, outerRadius, actorSpacing);
  const points: LayoutPoint[] = [];

  for (const ring of rings) {
    const angleStep = getSequentialAngleStep(ring.radius, actorSpacing);

    for (let index = 0; index < ring.actorCount; index += 1) {
      const angle = RADIAL_START_ANGLE + index * angleStep;
      points[ring.actorStartIndex + index] = getPointOnRing(
        center,
        ring.radius,
        angle
      );
    }
  }

  return points;
}
