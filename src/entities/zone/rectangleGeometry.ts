import type { LayoutPoint } from '@core/layout/types';
import { getPolygonBounds } from '@core/layout/polygonGeometry';
import { getPolygonCornerIndices, remapPolygonCorners } from '@core/layout/polygonCorners';
import { createRectanglePolygon } from './zoneShapeGeometry';

/** Assign all four corners together so skewed inputs cannot collapse on a tie. */
export function remapRectangleBounds(polygon: LayoutPoint[], first: LayoutPoint, last: LayoutPoint): LayoutPoint[] {
  const indices = getPolygonCornerIndices(polygon);
  if (indices.length !== 4) return polygon;
  const bounds = getPolygonBounds(polygon);
  const sourceCorners = createRectanglePolygon({ x: bounds.minX, y: bounds.minY }, { x: bounds.maxX, y: bounds.maxY });
  const targetCorners = createRectanglePolygon(first, last);
  let best = [0, 1, 2, 3], minimum = Infinity;
  for (const direction of [1, -1]) {
    for (let start = 0; start < 4; start++) {
      const order = indices.map((_, index) => (start + direction * index + 4) % 4);
      const distance = indices.reduce((sum, index, corner) => sum +
        (polygon[index].x - sourceCorners[order[corner]].x) ** 2 +
        (polygon[index].y - sourceCorners[order[corner]].y) ** 2, 0);
      if (distance < minimum) { minimum = distance; best = order; }
    }
  }
  const corners = new Map(indices.map((index, corner) => [polygon[index], targetCorners[best[corner]]]));
  return remapPolygonCorners(polygon, point => corners.get(point) ?? point);
}
