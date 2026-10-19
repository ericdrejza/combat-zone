import type { EncounterState } from '@core/encounter/types';
import type { Zone } from '@entities/zone/types';
import { snapZonePolygon } from '@core/movement/zoneVertexSnapping';
import { getZoneResizeAnchor } from './zoneResizeGeometry';

/** Keep the opposite resize control fixed while choosing fully snapped bounds. */
export function snapZoneResizePolygon(encounter: EncounterState, zone: Zone, vertexIndex: number) {
  return snapZonePolygon(encounter, zone, getZoneResizeAnchor(zone, zone.polygon, vertexIndex));
}
