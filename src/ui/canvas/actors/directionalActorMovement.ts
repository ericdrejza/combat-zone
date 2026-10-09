import type { EncounterState } from "@core/encounter/types";
import type { Zone } from "@entities/zone/types";

export type MoveDirection = "up" | "down" | "left" | "right";
export type MovementCandidate = { zoneId: string; tags: string[]; skillCheck: boolean };
export type OriginMovement = { originId: string; actorIds: string[]; candidates: MovementCandidate[]; index: number };

/** Centers are geometric perception, never persisted actor coordinates. */
export function zoneCenter(zone: Zone) {
  const xs = zone.polygon.map((p) => p.x); const ys = zone.polygon.map((p) => p.y);
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
}

export function getDirectionalCandidates(state: EncounterState, originId: string, direction: MoveDirection): MovementCandidate[] {
  const origin = state.zones.byId[originId];
  if (!origin) return [];
  const center = zoneCenter(origin);
  const incident = state.edges.allIds.map((id) => state.edges.byId[id]).filter((e) => e && (e.fromZoneId === originId || e.toZoneId === originId));
  const distances = new Map<string, number>();
  const candidates: MovementCandidate[] = [];
  for (const id of state.zones.allIds) {
    const zone = state.zones.byId[id]; if (!zone || id === originId) continue;
    const point = zoneCenter(zone); const dx = point.x - center.x; const dy = point.y - center.y;
    if (!(direction === "up" ? dy < 0 : direction === "down" ? dy > 0 : direction === "left" ? dx < 0 : dx > 0)) continue;
    const routes = incident.filter((e) => (e.fromZoneId === originId && e.toZoneId === id) || (e.directionality === "bilateral" && e.toZoneId === originId && e.fromZoneId === id));
    if (incident.length && (!routes.length || routes.some((e) => e.movementRules.includes("blocked")))) continue;
    const tags = [...new Set(routes.flatMap((e) => [...e.movementRules, ...e.interactionTags]))];
    candidates.push({ zoneId: id, tags, skillCheck: routes.some((e) => e.movementRules.includes("skillCheck")) });
    distances.set(id, Math.hypot(dx, dy));
  }
  if (!incident.length) return candidates.sort((a, b) => distances.get(a.zoneId)! - distances.get(b.zoneId)! || state.zones.allIds.indexOf(a.zoneId) - state.zones.allIds.indexOf(b.zoneId)).slice(0, 1);
  return candidates.sort((a, b) => {
    const ac = zoneCenter(state.zones.byId[a.zoneId]); const bc = zoneCenter(state.zones.byId[b.zoneId]);
    return direction === "left" || direction === "right" ? ac.y - bc.y || ac.x - bc.x : ac.x - bc.x || ac.y - bc.y;
  });
}

export function buildOriginMovements(state: EncounterState, actorIds: string[], direction: MoveDirection): OriginMovement[] {
  const origins = new Map<string, string[]>();
  for (const id of actorIds) {
    const actor = state.actors.byId[id]; if (!actor) continue;
    origins.set(actor.currentZoneId, [...(origins.get(actor.currentZoneId) ?? []), id]);
  }
  return [...origins].map(([originId, ids]) => ({ originId, actorIds: ids, candidates: getDirectionalCandidates(state, originId, direction), index: 0 }));
}
