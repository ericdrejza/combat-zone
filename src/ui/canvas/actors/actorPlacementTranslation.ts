import type { LayoutPoint } from '@core/layout/types';
import { POLYGON_LAYOUT_SETTINGS } from '@core/layout/polygonFlexLayout';
import {
  cacheActorPlacementGeometry,
  createActorPlacementCacheKey
} from './actorPlacementCache';
import type { ActorRenderPlacement } from './actorCanvasLayout';
import { FLEX_ZONE_EDGE_GAP } from './actorFlexLayout';

export type ActorPlacementTranslation = {
  offset: LayoutPoint;
  zoneId: string;
};

/**
 * Seeds the post-move cache entry by translating existing geometry. A zone move
 * preserves every actor's relationship to the zone and to its neighbors, so
 * running the polygon packer again would produce the same result translated.
 */
export function cacheActorRenderPlacementsForZoneMove(
  encounter: Parameters<typeof createActorPlacementCacheKey>[0],
  placements: ActorRenderPlacement[],
  zoneId: string,
  offset: LayoutPoint
): void {
  const nextKey = createActorPlacementCacheKey(
    encounter,
    POLYGON_LAYOUT_SETTINGS,
    FLEX_ZONE_EDGE_GAP
  );
  const geometry = placements.map(({ actor, point, radius }) => ({
    actorId: actor.id,
    point:
      actor.currentZoneId === zoneId
        ? { x: point.x + offset.x, y: point.y + offset.y }
        : point,
    radius
  }));

  cacheActorPlacementGeometry(nextKey, geometry);
}
