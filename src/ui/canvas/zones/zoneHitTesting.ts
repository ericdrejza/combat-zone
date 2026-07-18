import type { EncounterState } from '@core/encounter/types';
import type { LayoutPoint } from '@core/layout/types';
import { isPointInPolygon } from './zoneGeometry';

export function findZoneIdAtPoint(
  encounter: EncounterState,
  point: LayoutPoint
): string | undefined {
  return [...encounter.zones.allIds].reverse().find((zoneId) => {
    const zone = encounter.zones.byId[zoneId];

    return zone ? isPointInPolygon(point, zone.polygon) : false;
  });
}
