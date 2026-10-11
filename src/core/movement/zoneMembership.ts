import { ZONELESS_ACTOR_ZONE_ID, type EncounterState } from '@core/encounter/types';
import type { Actor } from '@entities/actor/types';
import type { LayoutPoint } from '@core/layout/types';
import { getFootprint, isPointInPolygon } from '@core/layout/polygonGeometry';
import { doPolygonsOverlap } from '@core/layout/polygonCollision';
import { toNestingActor } from '@core/layout/actorFootprints';
import type { CanvasPreferences } from '@ui/canvas_preferences/canvasPreferenceStorage';
import { actorAnchorCells, pointDistance } from './gridTopology';

export type MembershipChoice = { actorId: string; candidates: string[]; nextDecider: number };
/** Uses the area centroid, including concave polygons; degenerate imports are rejected elsewhere. */
export function polygonCentroid(polygon: LayoutPoint[]): LayoutPoint {
  let area = 0, x = 0, y = 0;
  polygon.forEach((p, i) => { const n = polygon[(i + 1) % polygon.length], cross = p.x * n.y - n.x * p.y; area += cross; x += (p.x + n.x) * cross; y += (p.y + n.y) * cross; });
  return Math.abs(area) < 1e-8 ? polygon[0] : { x: x / (3 * area), y: y / (3 * area) };
}

export function membershipCandidates(state: EncounterState, actor: Actor, point: LayoutPoint, preferences: CanvasPreferences): string[] {
  const method = preferences.membership === 'cells' && !state.movementRules.snapToGrid ? preferences.fallback : preferences.membership;
  const cells = method === 'cells' ? actorAnchorCells(state, point, actor.size) : [];
  return state.zones.allIds.filter(id => {
    const polygon = state.zones.byId[id].polygon;
    if (method === 'center') return isPointInPolygon(point, polygon);
    if (method === 'cells') return cells.some(cell => isPointInPolygon(cell.center, polygon));
    return doPolygonsOverlap(getFootprint(toNestingActor(actor), point, 0, 48), polygon);
  });
}

/** Returns a decision request instead of performing UI work inside reducers or workers. */
export function resolveMembership(state: EncounterState, actor: Actor, point: LayoutPoint, preferences: CanvasPreferences,
  candidates = membershipCandidates(state, actor, point, preferences), start = 0): string | MembershipChoice {
  if (!candidates.length) return ZONELESS_ACTOR_ZONE_ID;
  let remaining = candidates;
  for (let index = start; index < preferences.deciders.length && remaining.length > 1; index++) {
    switch (preferences.deciders[index]) {
      case 'cells': {
        if (!state.movementRules.snapToGrid) break;
        const cells = actorAnchorCells(state, point, actor.size);
        const counts = remaining.map(id => cells.filter(cell => isPointInPolygon(cell.center, state.zones.byId[id].polygon)).length);
        const most = Math.max(...counts); remaining = remaining.filter((_, i) => counts[i] === most); break;
      }
      case 'nearest': {
        const distances = remaining.map(id => pointDistance(point, polygonCentroid(state.zones.byId[id].polygon)));
        const nearest = Math.min(...distances); remaining = remaining.filter((_, i) => Math.abs(distances[i] - nearest) < 1e-7); break;
      }
      case 'current': if (remaining.includes(actor.currentZoneId)) return actor.currentZoneId; break;
      case 'ask': return { actorId: actor.id, candidates: remaining, nextDecider: index + 1 };
    }
  }
  return remaining.length === 1 ? remaining[0] : { actorId: actor.id, candidates: remaining, nextDecider: preferences.deciders.length };
}
