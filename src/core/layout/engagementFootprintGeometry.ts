import type { ActorShape } from '@entities/actor/types';
import {
  distanceToSegment,
  GEOMETRY_EPSILON
} from './polygonGeometry';
import type { LayoutPoint } from './types';

export type EngagementFootprint = {
  point: LayoutPoint;
  radius: number;
  shape?: ActorShape;
};

function shapeOf(footprint: EngagementFootprint): ActorShape {
  return footprint.shape ?? 'circle';
}

/** Returns whether two complete rendered footprints retain the given gap. */
export function engagementFootprintsAreSeparate(
  first: EngagementFootprint,
  second: EngagementFootprint,
  clearance: number
): boolean {
  const firstShape = shapeOf(first);
  const secondShape = shapeOf(second);
  const dx = Math.abs(first.point.x - second.point.x);
  const dy = Math.abs(first.point.y - second.point.y);

  if (firstShape === 'rectangle' && secondShape === 'rectangle') {
    const required = first.radius + second.radius + clearance;
    return dx + GEOMETRY_EPSILON >= required ||
      dy + GEOMETRY_EPSILON >= required;
  }
  if (firstShape === 'circle' && secondShape === 'circle') {
    return Math.hypot(dx, dy) + GEOMETRY_EPSILON >=
      first.radius + second.radius + clearance;
  }

  const circle = firstShape === 'circle' ? first : second;
  const rectangle = firstShape === 'rectangle' ? first : second;
  const nearestDx = Math.max(
    Math.abs(circle.point.x - rectangle.point.x) - rectangle.radius,
    0
  );
  const nearestDy = Math.max(
    Math.abs(circle.point.y - rectangle.point.y) - rectangle.radius,
    0
  );
  return Math.hypot(nearestDx, nearestDy) + GEOMETRY_EPSILON >=
    circle.radius + clearance;
}

function segmentIntersectsRectangle(
  start: LayoutPoint,
  end: LayoutPoint,
  center: LayoutPoint,
  halfExtent: number
): boolean {
  const delta = { x: end.x - start.x, y: end.y - start.y };
  let minimum = 0;
  let maximum = 1;

  for (const axis of ['x', 'y'] as const) {
    const lower = center[axis] - halfExtent;
    const upper = center[axis] + halfExtent;
    if (Math.abs(delta[axis]) <= GEOMETRY_EPSILON) {
      if (start[axis] < lower || start[axis] > upper) return false;
      continue;
    }
    const first = (lower - start[axis]) / delta[axis];
    const second = (upper - start[axis]) / delta[axis];
    minimum = Math.max(minimum, Math.min(first, second));
    maximum = Math.min(maximum, Math.max(first, second));
    if (minimum > maximum) return false;
  }
  return minimum <= maximum;
}

/** Treats the connector as a segment and the actor as its complete shape. */
export function engagementSegmentClearsFootprint(
  start: LayoutPoint,
  end: LayoutPoint,
  footprint: EngagementFootprint,
  clearance: number
): boolean {
  return shapeOf(footprint) === 'rectangle'
    ? !segmentIntersectsRectangle(
        start,
        end,
        footprint.point,
        footprint.radius + clearance
      )
    : distanceToSegment(footprint.point, start, end) +
        GEOMETRY_EPSILON >=
      footprint.radius + clearance;
}
