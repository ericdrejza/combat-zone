import { rotatePoint } from '@entities/zone/zoneRotation';
import type { LayoutPoint } from '@core/layout/types';
import { POLYGON_LAYOUT_SETTINGS } from '@core/layout/polygonFlexLayout';
import {
  cacheActorPlacementGeometry,
  getCachedActorPlacementGeometry,
  createActorPlacementCacheKey
} from './actorPlacementCache';
import type { ActorRenderPlacement } from './actorCanvasLayout';
import { FLEX_ZONE_EDGE_GAP } from './actorFlexLayout';

export type ActorPlacementTranslation = {
  offset: LayoutPoint;
  zoneId: string;
  origin?: LayoutPoint;
  scale?: LayoutPoint;
  fromRotation?: number;
  toRotation?: number;
};

/** Resize preview moves token centers without scaling artwork or repacking. */
export function transformZoneActorPoint(point: LayoutPoint, zoneId: string, preview?: ActorPlacementTranslation | null): LayoutPoint {
  if (!preview || preview.zoneId !== zoneId) return point;
  const origin = preview.origin ?? { x: 0, y: 0 };
  if (preview.fromRotation) point = rotatePoint(point, -preview.fromRotation);
  return rotatePoint({
    x: origin.x + (point.x - origin.x) * (preview.scale?.x ?? 1) + preview.offset.x,
    y: origin.y + (point.y - origin.y) * (preview.scale?.y ?? 1) + preview.offset.y
  }, preview.toRotation ?? 0);
}

/**
 * Seeds the post-move cache entry by translating existing geometry. A zone move
 * preserves every actor's relationship to the zone and to its neighbors, so
 * running the polygon packer again would produce the same result translated.
 */
export function cacheActorRenderPlacementsForZoneMove(
  encounter: Parameters<typeof createActorPlacementCacheKey>[0],
  placements: ActorRenderPlacement[],
  zoneId: string,
  offset: LayoutPoint,
  sourceEncounter?: Parameters<typeof createActorPlacementCacheKey>[0]
): void {
  if (sourceEncounter) {
    const source = getCachedActorPlacementGeometry(createActorPlacementCacheKey(sourceEncounter, POLYGON_LAYOUT_SETTINGS, FLEX_ZONE_EDGE_GAP));
    // A just-accepted resize may still be awaiting new packing geometry. Never
    // bless its previous optimistic placements as the moved Zone's final cache.
    const byId = new Map(placements.map(placement => [placement.actor.id, placement]));
    if (!source || source.length !== placements.length || source.some(item => {
      const placement = byId.get(item.actorId);
      return !placement || placement.point.x !== item.point.x || placement.point.y !== item.point.y;
    })) return;
  }
  const nextKey = createActorPlacementCacheKey(
    encounter,
    POLYGON_LAYOUT_SETTINGS,
    FLEX_ZONE_EDGE_GAP
  );
  const geometry = placements.map(({
    actor,
    engagementTokenPoint,
    point,
    radius,
    sectionPolygon
  }) => ({
    actorId: actor.id,
    ...(engagementTokenPoint
      ? {
          engagementTokenPoint:
            actor.currentZoneId === zoneId
              ? {
                  x: engagementTokenPoint.x + offset.x,
                  y: engagementTokenPoint.y + offset.y
                }
              : engagementTokenPoint
        }
      : {}),
    point:
      actor.currentZoneId === zoneId
        ? { x: point.x + offset.x, y: point.y + offset.y }
        : point,
    radius,
    ...(sectionPolygon
      ? {
          sectionPolygon:
            actor.currentZoneId === zoneId
              ? sectionPolygon.map((vertex) => ({
                  x: vertex.x + offset.x,
                  y: vertex.y + offset.y
                }))
              : sectionPolygon
        }
      : {})
  }));

  cacheActorPlacementGeometry(nextKey, geometry);
}
