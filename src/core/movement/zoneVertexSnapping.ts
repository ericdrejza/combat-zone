import { resolveGridGeometry } from './gridScale';
import { gridToWorld, snapToGrid } from './gridGeometry';
import type { EncounterState } from '@core/encounter/types';
import type { Zone } from '@entities/zone/types';
import type { LayoutPoint } from '@core/layout/types';
import { getPolygonBounds } from '@core/layout/polygonGeometry';
import { nearestGridVertex, pointDistance } from './gridTopology';

/** Generated shapes retain their outline; only their bounding drawing controls snap. */
export function snapZonePolygon(state: EncounterState, zone: Pick<Zone, 'shape' | 'polygon'>): LayoutPoint[] {
  if (!state.movementRules.snapZoneVertices) return zone.polygon;
  if (zone.shape === 'polygon') return zone.polygon.map(point => nearestGridVertex(state, point));
  const bounds = getPolygonBounds(zone.polygon);
  const first = nearestGridVertex(state, { x: bounds.minX, y: bounds.minY });
  const last = nearestGridVertex(state, { x: bounds.maxX, y: bounds.maxY });
  if ((bounds.maxX - bounds.minX) < 1e-8 || (bounds.maxY - bounds.minY) < 1e-8 || last.x <= first.x || last.y <= first.y) return zone.polygon;
  return zone.polygon.map(point => ({ x: first.x + (point.x - bounds.minX) / (bounds.maxX - bounds.minX) * (last.x - first.x), y: first.y + (point.y - bounds.minY) / (bounds.maxY - bounds.minY) * (last.y - first.y) }));
}
export function reconcileZoneVertices(state: EncounterState): EncounterState {
  if (!state.movementRules.snapZoneVertices) return state;
  const byId = { ...state.zones.byId }; let changed = false;
  for (const id of state.zones.allIds) {
    const zone = byId[id], polygon = snapZonePolygon(state, zone);
    if (polygon.some((point, i) => pointDistance(point, zone.polygon[i]) > 1e-6)) { byId[id] = { ...zone, polygon }; changed = true; }
  }
  return changed ? { ...state, zones: { ...state.zones, byId } } : state;
}
export function zoneSnappingValid(state: EncounterState, zone: Zone) {
  const bounds = getPolygonBounds(zone.polygon);
  const points = zone.shape === 'polygon' ? zone.polygon : [{ x: bounds.minX, y: bounds.minY }, { x: bounds.maxX, y: bounds.maxY }];
  return points.every(point => pointDistance(point, nearestGridVertex(state, point)) < 1e-5);
}

/** Lattice translations preserve both vertex classes of a hex grid and every edge vector. */
export function translateSnappedZone(state: EncounterState, zone: Pick<Zone, 'shape' | 'polygon'>, offset: LayoutPoint): LayoutPoint[] {
  const polygon = zone.polygon;
  let translation = offset;
  if (state.movementRules.snapZoneVertices && !state.grid.warp) {
    const grid = resolveGridGeometry(state.grid);
    const reference = gridToWorld(grid, grid.type === 'square' ? { x: grid.cellSize / 2, y: grid.cellSize / 2 } : { x: 0, y: 0 });
    const target = snapToGrid(grid, { x: reference.x + offset.x, y: reference.y + offset.y }, 'medium');
    translation = { x: target.x - reference.x, y: target.y - reference.y };
  } else if (state.movementRules.snapZoneVertices && polygon.length) {
    const bounds = getPolygonBounds(polygon);
    const reference = zone.shape === 'polygon' ? polygon[0] : { x: bounds.minX, y: bounds.minY };
    const target = nearestGridVertex(state, { x: reference.x + offset.x, y: reference.y + offset.y });
    translation = { x: target.x - reference.x, y: target.y - reference.y };
  }
  return polygon.map(point => ({ x: point.x + translation.x, y: point.y + translation.y }));
}
