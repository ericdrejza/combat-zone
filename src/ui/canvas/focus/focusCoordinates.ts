import type { LayoutPoint } from '@core/layout/types';
import type { CanvasSize } from '@core/layout/polygonCanvasBounds';
import { toSvgPoint } from '@ui/canvas/zones/zoneGeometry';
import { playerFrame, type PlayerRegion } from '@ui/player_view/playerCamera';

export function canvasFocusPoint(point: LayoutPoint, element: Element): LayoutPoint | null {
  const svg = element as SVGSVGElement;
  const bounds = svg.getBoundingClientRect();
  if (bounds.width <= 0 || bounds.height <= 0) return null;
  const result = toSvgPoint({ clientX: point.x, clientY: point.y }, svg);
  const box = svg.getAttribute('viewBox')?.split(/\s+/).map(Number);
  return box && result.x >= box[0] && result.y >= box[1] && result.x <= box[0] + box[2] && result.y <= box[1] + box[3] ? result : null;
}

/** Match both projection letterboxes, excluding black margins from pointer input. */
export function projectedFocusPoint(point: LayoutPoint, element: Element, region: PlayerRegion, size: CanvasSize): LayoutPoint | null {
  const bounds = element.getBoundingClientRect();
  if (bounds.width <= 0 || bounds.height <= 0) return null;
  const outer = playerFrame({ x: 0, y: 0, ...size }, bounds);
  const inner = playerFrame(region, size);
  const scale = outer.scale * inner.scale;
  const result = { x: region.x + (point.x - bounds.left - outer.x - inner.x * outer.scale) / scale,
    y: region.y + (point.y - bounds.top - outer.y - inner.y * outer.scale) / scale };
  return result.x >= region.x && result.y >= region.y && result.x <= region.x + region.width && result.y <= region.y + region.height ? result : null;
}
