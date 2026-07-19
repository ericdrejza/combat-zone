import type { LayoutPoint } from '@core/layout/types';
import { doPolygonsOverlap as doCorePolygonsOverlap } from '@core/layout/polygonCollision';
import {
  isPointWithinCanvas,
  isPolygonWithinCanvas
} from '@core/layout/polygonCanvasBounds';
export { isPointWithinCanvas, isPolygonWithinCanvas };
import type { RootState } from '@store/store';
import type { Bounds } from './zoneShapeGeometry';
import { getPolygonBounds } from './zoneShapeGeometry';

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
  return doCorePolygonsOverlap(first, second);
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
