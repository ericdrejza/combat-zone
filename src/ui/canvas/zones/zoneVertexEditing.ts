import type { EncounterState } from '@core/encounter/types';
import type { LayoutPoint } from '@core/layout/types';
import type { Zone } from '@entities/zone/types';
import { nearestGridVertex } from '@core/movement/gridTopology';
import { getViewBoxTransform } from '@ui/canvas/canvasCoordinates';

const HIT_RANGE_PX = 12;
const MIN_SPACING_PX = 24;

export type ZoneVertexEdit = {
  zone: Zone;
  kind: 'insert' | 'remove';
  vertexIndex: number;
  polygon: LayoutPoint[] | null;
};

function distance(a: LayoutPoint, b: LayoutPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function edgeDistance(point: LayoutPoint, a: LayoutPoint, b: LayoutPoint): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared ? Math.max(0, Math.min(1,
    ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared)) : 0;
  return distance(point, { x: a.x + t * dx, y: a.y + t * dy });
}

/** Hit testing uses screen pixels, including the SVG's fitted zoom scale. */
export function getZoneVertexEdit(
  encounter: EncounterState,
  point: LayoutPoint,
  svg: SVGSVGElement
): ZoneVertexEdit | null {
  const scale = getViewBoxTransform(svg.getBoundingClientRect(), encounter.canvasSize)?.scale ?? 1;
  const zones = encounter.zones.allIds.map(id => encounter.zones.byId[id])
    .filter((zone): zone is Zone => !!zone && zone.shape === 'polygon');
  let vertexHit: { zone: Zone; index: number; distance: number } | null = null;
  let edgeHit: { zone: Zone; index: number; distance: number } | null = null;
  for (const zone of zones) {
    for (const [index, vertex] of zone.polygon.entries()) {
      const vertexDistance = distance(point, vertex) * scale;
      if (vertexDistance <= HIT_RANGE_PX && (!vertexHit || vertexDistance < vertexHit.distance)) {
        vertexHit = { zone, index, distance: vertexDistance };
      }
      const segmentDistance = edgeDistance(point, vertex, zone.polygon[(index + 1) % zone.polygon.length]) * scale;
      if (segmentDistance <= HIT_RANGE_PX && (!edgeHit || segmentDistance < edgeHit.distance)) {
        edgeHit = { zone, index, distance: segmentDistance };
      }
    }
  }
  // A vertex takes priority over its incident edges. A rejected edit still
  // consumes the double click rather than completing an unrelated Zone draft.
  if (vertexHit) {
    const { zone, index } = vertexHit;
    return { zone, kind: 'remove', vertexIndex: index,
      polygon: zone.polygon.length > 3 ? zone.polygon.filter((_, i) => i !== index) : null };
  }
  if (!edgeHit) return null;
  const { zone, index } = edgeHit;
  const vertex = encounter.movementRules.snapZoneVertices ? nearestGridVertex(encounter, point) : point;
  const tooClose = zone.polygon.some(existing => distance(existing, vertex) * scale < MIN_SPACING_PX);
  const polygon = [...zone.polygon];
  polygon.splice(index + 1, 0, vertex);
  return { zone, kind: 'insert', vertexIndex: index + 1, polygon: tooClose ? null : polygon };
}
