import { getZoneLocalPolygon, rotatePoint } from '@entities/zone/zoneRotation';
import { getPolygonBounds } from '@core/layout/polygonGeometry';
import type { LayoutPoint } from '@core/layout/types';

/** Quantize the handle's outward direction to the four native resize cursors. */
export function zoneResizeCursor(polygon: LayoutPoint[], point: LayoutPoint, rotation = 0) {
  const localPolygon = getZoneLocalPolygon({ polygon, rotation });
  point = rotatePoint(point, -rotation);
  const bounds = getPolygonBounds(localPolygon);
  const x = (point.x - (bounds.minX + bounds.maxX) / 2) / Math.max(bounds.maxX - bounds.minX, 1e-8);
  const y = (point.y - (bounds.minY + bounds.maxY) / 2) / Math.max(bounds.maxY - bounds.minY, 1e-8);
  const direction = rotatePoint({ x, y }, rotation);
  const dx = direction.x, dy = direction.y;
  if (Math.abs(dx) < Math.abs(dy) * Math.tan(Math.PI / 8)) return 'ns-resize';
  if (Math.abs(dy) < Math.abs(dx) * Math.tan(Math.PI / 8)) return 'ew-resize';
  return dx * dy >= 0 ? 'nwse-resize' : 'nesw-resize';
}
