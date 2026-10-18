import type { LayoutPoint } from '@core/layout/types';
import type { ActorRenderPlacement } from './actorCanvasLayout';
import { setOptimisticActorPlacement } from './actorPlacementOptimisticState';
import { rebaseZoneActorPlacements } from './rebaseZoneActorPlacements';

/** Hold the visible resize positions until authoritative packing supplies targets. */
export function retainResizeActorPreview(
  placements: ActorRenderPlacement[],
  zoneId: string,
  originalPolygon: LayoutPoint[],
  previewPolygon: LayoutPoint[]
): void {
  for (const { actor, point } of rebaseZoneActorPlacements(placements, zoneId, originalPolygon, previewPolygon)) {
    if (actor.currentZoneId === zoneId) setOptimisticActorPlacement(actor.id, point);
  }
}
