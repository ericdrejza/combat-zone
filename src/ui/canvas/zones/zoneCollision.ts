import type { LayoutPoint } from '@core/layout/types';
import type { RootState } from '@store/store';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../canvasConstants';
import type { Bounds } from './zoneShapeGeometry';
import { getPolygonBounds } from './zoneShapeGeometry';

export function isPointWithinCanvas(point: LayoutPoint): boolean {
  return (
    point.x >= 0 &&
    point.x <= CANVAS_WIDTH &&
    point.y >= 0 &&
    point.y <= CANVAS_HEIGHT
  );
}

export function isPolygonWithinCanvas(polygon: LayoutPoint[]): boolean {
  return polygon.every(isPointWithinCanvas);
}

export function isPointInPolygon(
  point: LayoutPoint,
  polygon: LayoutPoint[]
): boolean {
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

export function doBoundsOverlap(first: Bounds, second: Bounds): boolean {
  return (
    first.x < second.x + second.width &&
    first.x + first.width > second.x &&
    first.y < second.y + second.height &&
    first.y + first.height > second.y
  );
}

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

export function doesZoneOverlapExisting(
  polygon: LayoutPoint[],
  zones: RootState['encounter']['present']['zones'],
  ignoredZoneId?: string
): boolean {
  return zones.allIds.some((zoneId) => {
    const zone = zones.byId[zoneId];

    return (
      zone &&
      zone.id !== ignoredZoneId &&
      doPolygonsOverlap(polygon, zone.polygon)
    );
  });
}

export function canCommitZonePolygon(
  polygon: LayoutPoint[],
  zones: RootState['encounter']['present']['zones'],
  ignoredZoneId?: string
): boolean {
  return (
    isPolygonWithinCanvas(polygon) &&
    !doesZoneOverlapExisting(polygon, zones, ignoredZoneId)
  );
}
