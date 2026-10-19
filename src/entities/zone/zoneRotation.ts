import type { LayoutPoint } from '@core/layout/types';
import { getPolygonBounds } from '@core/layout/polygonGeometry';
import type { EncounterState } from '@core/encounter/types';
import type { Zone } from './types';

/** Signed clockwise degrees in SVG's downward-positive coordinate system. */
export function normalizeRotation(degrees: number): number {
  const value = ((degrees + 180) % 360 + 360) % 360 - 180;
  return Math.abs(value) < 1e-8 ? 0 : value;
}

export function rotatePoint(point: LayoutPoint, degrees: number, center: LayoutPoint = { x: 0, y: 0 }): LayoutPoint {
  if (!degrees) return point;
  const radians = degrees * Math.PI / 180;
  const cosine = Math.cos(radians), sine = Math.sin(radians);
  const x = point.x - center.x, y = point.y - center.y;
  return { x: center.x + x * cosine - y * sine, y: center.y + x * sine + y * cosine };
}

/** Unrotate about the origin so the local frame remains derivable after any edit. */
export function getZoneLocalPolygon(zone: Pick<Zone, 'polygon' | 'rotation'>): LayoutPoint[] {
  if (!zone.rotation) return zone.polygon;
  // Inverse rotation introduces tiny differences between originally collinear
  // coordinates. Keep generated rectangles recognizable to deterministic packing.
  return zone.polygon.map(point => {
    const local = rotatePoint(point, -zone.rotation!);
    return { x: Math.round(local.x * 1e8) / 1e8, y: Math.round(local.y * 1e8) / 1e8 };
  });
}

export function getZoneRotationCenter(zone: Pick<Zone, 'polygon' | 'rotation'>): LayoutPoint {
  const bounds = getPolygonBounds(getZoneLocalPolygon(zone));
  return rotatePoint({ x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 }, zone.rotation ?? 0);
}

/** Polygon and orientation always change in the same history snapshot. */
export function updateZoneGeometry(state: EncounterState, zoneId: string, polygon: LayoutPoint[], rotation?: number): EncounterState {
  const zone = state.zones.byId[zoneId];
  if (!zone) return state;
  return { ...state, zones: { ...state.zones, byId: { ...state.zones.byId,
    [zoneId]: { ...zone, polygon, ...(rotation === undefined ? {} : { rotation: normalizeRotation(rotation) }) }
  } } };
}
