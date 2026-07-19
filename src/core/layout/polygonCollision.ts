import type { LayoutPoint } from './types';
import { getPolygonBounds } from './polygonGeometry';

function isPointInPolygon(point: LayoutPoint, polygon: LayoutPoint[]): boolean {
  return polygon.reduce((inside, current, index) => {
    const previous = polygon[(index + polygon.length - 1) % polygon.length];
    const intersects =
      current.y > point.y !== previous.y > point.y &&
      point.x <
        ((previous.x - current.x) * (point.y - current.y)) /
          (previous.y - current.y) +
          current.x;

    return intersects ? !inside : inside;
  }, false);
}

function orientation(
  first: LayoutPoint,
  second: LayoutPoint,
  third: LayoutPoint
): number {
  return (
    (second.y - first.y) * (third.x - second.x) -
    (second.x - first.x) * (third.y - second.y)
  );
}

function isPointOnSegment(
  point: LayoutPoint,
  start: LayoutPoint,
  end: LayoutPoint
): boolean {
  return (
    Math.min(start.x, end.x) <= point.x &&
    point.x <= Math.max(start.x, end.x) &&
    Math.min(start.y, end.y) <= point.y &&
    point.y <= Math.max(start.y, end.y)
  );
}

function doSegmentsIntersect(
  firstStart: LayoutPoint,
  firstEnd: LayoutPoint,
  secondStart: LayoutPoint,
  secondEnd: LayoutPoint
): boolean {
  const firstOrientation = orientation(firstStart, firstEnd, secondStart);
  const secondOrientation = orientation(firstStart, firstEnd, secondEnd);
  const thirdOrientation = orientation(secondStart, secondEnd, firstStart);
  const fourthOrientation = orientation(secondStart, secondEnd, firstEnd);

  if (
    firstOrientation === 0 &&
    isPointOnSegment(secondStart, firstStart, firstEnd)
  ) {
    return true;
  }

  if (
    secondOrientation === 0 &&
    isPointOnSegment(secondEnd, firstStart, firstEnd)
  ) {
    return true;
  }

  if (
    thirdOrientation === 0 &&
    isPointOnSegment(firstStart, secondStart, secondEnd)
  ) {
    return true;
  }

  if (
    fourthOrientation === 0 &&
    isPointOnSegment(firstEnd, secondStart, secondEnd)
  ) {
    return true;
  }

  return (
    firstOrientation > 0 !== secondOrientation > 0 &&
    thirdOrientation > 0 !== fourthOrientation > 0
  );
}

function doBoundsOverlap(
  first: ReturnType<typeof getPolygonBounds>,
  second: ReturnType<typeof getPolygonBounds>
): boolean {
  return (
    first.minX < second.maxX &&
    first.maxX > second.minX &&
    first.minY < second.maxY &&
    first.maxY > second.minY
  );
}

/** Returns whether two polygonal zones occupy any overlapping area. */
export function doPolygonsOverlap(
  first: LayoutPoint[],
  second: LayoutPoint[]
): boolean {
  if (!doBoundsOverlap(getPolygonBounds(first), getPolygonBounds(second))) {
    return false;
  }

  const hasCrossingEdges = first.some((firstPoint, firstIndex) => {
    const firstNext = first[(firstIndex + 1) % first.length];

    return second.some((secondPoint, secondIndex) => {
      const secondNext = second[(secondIndex + 1) % second.length];

      return doSegmentsIntersect(
        firstPoint,
        firstNext,
        secondPoint,
        secondNext
      );
    });
  });

  return (
    hasCrossingEdges ||
    isPointInPolygon(first[0], second) ||
    isPointInPolygon(second[0], first)
  );
}
