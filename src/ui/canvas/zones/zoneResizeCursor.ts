import { getPolygonBounds } from '@core/layout/polygonGeometry';
import type { LayoutPoint } from '@core/layout/types';

/** Quantize the handle's outward direction to the four native resize cursors. */
export function zoneResizeCursor(polygon: LayoutPoint[], point: LayoutPoint) {
  const bounds = getPolygonBounds(polygon);
  const x = (point.x - (bounds.minX + bounds.maxX) / 2) / Math.max(bounds.maxX - bounds.minX, 1e-8);
  const y = (point.y - (bounds.minY + bounds.maxY) / 2) / Math.max(bounds.maxY - bounds.minY, 1e-8);
  if (Math.abs(x) < Math.abs(y) * Math.tan(Math.PI / 8)) return 'ns-resize';
  if (Math.abs(y) < Math.abs(x) * Math.tan(Math.PI / 8)) return 'ew-resize';
  return x * y >= 0 ? 'nwse-resize' : 'nesw-resize';
}
