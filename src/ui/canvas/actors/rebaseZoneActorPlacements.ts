import { getZoneLocalPolygon } from '@entities/zone/zoneRotation';
import { getPolygonBounds } from '@core/layout/polygonGeometry';
import type { LayoutPoint } from '@core/layout/types';
import type { ActorRenderPlacement } from './actorCanvasLayout';
import { transformZoneActorPoint } from './actorPlacementTranslation';

/** Re-express a preview in the accepted Zone coordinate frame without repacking. */
export function rebaseZoneActorPlacements(placements: ActorRenderPlacement[], zoneId: string, sourcePolygon: LayoutPoint[], polygon: LayoutPoint[], fromRotation = 0, toRotation = fromRotation): ActorRenderPlacement[] {
  if (sourcePolygon === polygon && fromRotation === toRotation) return placements;
  const from = getPolygonBounds(getZoneLocalPolygon({ polygon: sourcePolygon, rotation: fromRotation })), to = getPolygonBounds(getZoneLocalPolygon({ polygon, rotation: toRotation }));
  const transform = {
    zoneId, fromRotation, toRotation,
    origin: { x: from.minX, y: from.minY },
    offset: { x: to.minX - from.minX, y: to.minY - from.minY },
    scale: {
      x: from.maxX > from.minX ? (to.maxX - to.minX) / (from.maxX - from.minX) : 1,
      y: from.maxY > from.minY ? (to.maxY - to.minY) / (from.maxY - from.minY) : 1
    }
  };
  return placements.map(placement => placement.actor.currentZoneId !== zoneId ? placement : ({
    ...placement,
    point: transformZoneActorPoint(placement.point, zoneId, transform),
    ...(placement.engagementTokenPoint ? { engagementTokenPoint: transformZoneActorPoint(placement.engagementTokenPoint, zoneId, transform) } : {}),
    ...(placement.sectionPolygon ? { sectionPolygon: placement.sectionPolygon.map(point => transformZoneActorPoint(point, zoneId, transform)) } : {})
  }));
}
