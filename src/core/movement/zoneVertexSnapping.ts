import { snappedZoneBounds, zoneBoundsCorners } from './snappedZoneBounds';
import { remapZoneBounds } from '@entities/zone/remapZoneBounds';
import { getZoneLocalPolygon, rotatePoint } from '@entities/zone/zoneRotation';
import { isSquareTopology } from './gridProjection';
import { resolveGridGeometry } from './gridScale';
import { gridToWorld, snapToGrid } from './gridGeometry';
import type { EncounterState } from '@core/encounter/types';
import type { Zone } from '@entities/zone/types';
import type { LayoutPoint } from '@core/layout/types';
import { getPolygonBounds } from '@core/layout/polygonGeometry';
import { mergeConsecutivePolygonPoints, remapPolygonCorners } from '@core/layout/polygonCorners';
import { anchorKey as anchorKeyForCache, nearestGridVertex, pointDistance } from './gridTopology';

const usesBoundingResizeControls = (shape: Zone['shape']) => shape !== 'polygon';

// Immutable polygons and grid configurations let unchanged Zones share their
// snapped geometry across layers, pointer frames, and mutation preparation.
const snappedPolygons = new WeakMap<EncounterState['grid'], WeakMap<LayoutPoint[], Map<string, LayoutPoint[]>>>();

/** Generated bounds snap jointly; custom polygons snap every stored vertex. */
export function snapZonePolygon(state: EncounterState, zone: Pick<Zone, 'shape' | 'polygon' | 'rotation'>, anchor?: LayoutPoint): LayoutPoint[] {
  if (!state.movementRules.snapZoneVertices) return zone.polygon;
  let polygons = snappedPolygons.get(state.grid);
  if (!polygons) snappedPolygons.set(state.grid, polygons = new WeakMap());
  let shapes = polygons.get(zone.polygon);
  if (!shapes) polygons.set(zone.polygon, shapes = new Map());
  const key = `${zone.shape}:${zone.rotation ?? 0}:${anchor ? anchorKeyForCache(anchor) : ""}`;
  const cached = shapes.get(key);
  if (cached) return cached;
  const snapped = calculateSnappedPolygon(state, zone, anchor);
  const result = snapped.length === zone.polygon.length && snapped.every((point, i) =>
    point.x === zone.polygon[i].x && point.y === zone.polygon[i].y) ? zone.polygon : snapped;
  shapes.set(key, result);
  return result;
}

function calculateSnappedPolygon(state: EncounterState, zone: Pick<Zone, 'shape' | 'polygon' | 'rotation'>, anchor?: LayoutPoint): LayoutPoint[] {
  if (!usesBoundingResizeControls(zone.shape)) {
    return mergeConsecutivePolygonPoints(zone.polygon.map(point => nearestGridVertex(state, point)));
  }
  const snapped = snappedZoneBounds(state, zone, anchor);
  if (!snapped) return zone.polygon;
  const { first, last } = snapped;
  const polygon = remapZoneBounds(zone, first, last);
  // Use the actual grid coordinates: inverse/forward rotation can otherwise put
  // a boundary corner a few floating-point units outside the canvas.
  return zone.shape === 'rectangle'
    ? remapPolygonCorners(polygon, point => nearestGridVertex(state, point)) : polygon;
}
export function reconcileZoneVertices(state: EncounterState): EncounterState {
  if (!state.movementRules.snapZoneVertices) return state;
  const byId = { ...state.zones.byId }; let changed = false;
  for (const id of state.zones.allIds) {
    const zone = byId[id], polygon = snapZonePolygon(state, zone);
    if (polygon === zone.polygon) continue;
    if (polygon.length !== zone.polygon.length || polygon.some((point, i) => pointDistance(point, zone.polygon[i]) > 1e-6)) { byId[id] = { ...zone, polygon }; changed = true; }
  }
  return changed ? { ...state, zones: { ...state.zones, byId } } : state;
}
export function zoneSnappingValid(state: EncounterState, zone: Pick<Zone, 'shape' | 'polygon' | 'rotation'>) {
  const points = zone.shape === 'polygon' ? zone.polygon : zoneBoundsCorners(zone);
  return points.every(point => pointDistance(point, nearestGridVertex(state, point)) < 1e-5);
}

/** Lattice translations preserve both vertex classes of a hex grid and every edge vector. */
export function translateSnappedZone(state: EncounterState, zone: Pick<Zone, 'shape' | 'polygon' | 'rotation'>, offset: LayoutPoint): LayoutPoint[] {
  const polygon = zone.polygon;
  let translation = offset;
  if (state.movementRules.snapZoneVertices && !state.grid.warp) {
    const grid = resolveGridGeometry(state.grid);
    const reference = gridToWorld(grid, isSquareTopology(grid.type) ? { x: grid.cellSize / 2, y: grid.cellSize / 2 } : { x: 0, y: 0 });
    const target = snapToGrid(grid, { x: reference.x + offset.x, y: reference.y + offset.y }, 'medium');
    translation = { x: target.x - reference.x, y: target.y - reference.y };
  } else if (state.movementRules.snapZoneVertices && polygon.length) {
    const bounds = getPolygonBounds(getZoneLocalPolygon(zone));
    const reference = !usesBoundingResizeControls(zone.shape) ? polygon[0] : rotatePoint({ x: bounds.minX, y: bounds.minY }, zone.rotation ?? 0);
    const target = nearestGridVertex(state, { x: reference.x + offset.x, y: reference.y + offset.y });
    translation = { x: target.x - reference.x, y: target.y - reference.y };
  }
  return polygon.map(point => ({ x: point.x + translation.x, y: point.y + translation.y }));
}
