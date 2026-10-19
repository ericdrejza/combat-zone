import type { LayoutPoint } from '@core/layout/types';
import type { ZoneDragState } from '@ui/canvas/canvasInteractionTypes';

/** Bodies and editing controls must share the same continuous drag offset. */
export function displayedZoneDragPolygon(polygon: LayoutPoint[], drag: ZoneDragState | null): LayoutPoint[] {
  return drag?.phase === 'dragging' ? polygon.map(point => ({
    x: point.x + drag.current.x - drag.start.x,
    y: point.y + drag.current.y - drag.start.y
  })) : polygon;
}
