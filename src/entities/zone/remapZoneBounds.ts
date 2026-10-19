import type { LayoutPoint } from '@core/layout/types';
import { getPolygonBounds } from '@core/layout/polygonGeometry';
import type { Zone } from './types';
import { remapRectangleBounds } from './rectangleGeometry';
import { getZoneLocalPolygon, rotatePoint } from './zoneRotation';

/** Width and height change independently; generated outlines keep their editing frame. */
export function remapZoneBounds(zone: Pick<Zone, 'shape' | 'polygon' | 'rotation'>,
  first: LayoutPoint, last: LayoutPoint, rotation = zone.rotation ?? 0): LayoutPoint[] {
  const local = getZoneLocalPolygon(zone);
  if (zone.shape === 'rectangle') {
    return remapRectangleBounds(local, first, last).map(point => rotatePoint(point, rotation));
  }
  const bounds = getPolygonBounds(local);
  return local.map(point => rotatePoint({
    x: first.x + (point.x - bounds.minX) / (bounds.maxX - bounds.minX) * (last.x - first.x),
    y: first.y + (point.y - bounds.minY) / (bounds.maxY - bounds.minY) * (last.y - first.y)
  }, rotation));
}
