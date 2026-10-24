import type { EncounterState } from '@core/encounter/types';
import type { Zone } from '@entities/zone/types';
import type { ZoneDragState } from '@ui/canvas/canvasInteractionTypes';
import { displayedZoneDragPolygon } from '@ui/canvas/zones/displayedZoneDragPolygon';

/** Match the Zone layer's live geometry and opacity without changing encounter state. */
export function actorSurfaceZones(
  zones: EncounterState['zones'],
  getDisplayedPolygon: (zone: Zone) => Zone['polygon'],
  drag: ZoneDragState | null,
  opacityPreview: { zoneId: string; opacity: number } | null
): EncounterState['zones'] {
  return { ...zones, byId: Object.fromEntries(zones.allIds.map(id => {
    const zone = zones.byId[id];
    const zoneDrag = drag?.zoneId === id ? drag : null;
    const polygon = zoneDrag?.phase === 'dragging' ? zoneDrag.originalPolygon : getDisplayedPolygon(zone);
    return [id, { ...zone,
      polygon: displayedZoneDragPolygon(polygon, zoneDrag),
      opacity: opacityPreview?.zoneId === id ? opacityPreview.opacity : zone.opacity
    }];
  })) };
}
