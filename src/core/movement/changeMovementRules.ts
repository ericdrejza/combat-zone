import { adjustPolygonFlexZonesToFit } from '@core/validation/polygonFlexPlacement';
import { ZONELESS_ACTOR_ZONE_ID, type EncounterState } from '@core/encounter/types';
import type { MovementRules } from './types';
import type { LayoutPoint } from '@core/layout/types';
import { placeSpatialActors } from './movementStrategies';
import { completeGridEdges } from './gridEdgeCompletion';
import { reconcileZoneVertices } from './zoneVertexSnapping';
import { packGridZone } from './gridZonePacking';
import { PolygonPlacementValidator } from '@core/validation/polygonFlexPlacementValidator';

/** Rule toggles reconcile placements and group cascades in the same undoable snapshot. */
export function changeMovementRules(state: EncounterState, patch: Partial<MovementRules>, settledPositions: Record<string, LayoutPoint>): EncounterState {
  const movementRules = { ...state.movementRules, ...patch };
  if (movementRules.zoneLocked) movementRules.allowOverlap = false;
  if (!movementRules.snapToGrid) movementRules.trimTokens = false;
  let next: EncounterState = { ...state, movementRules };
  if (movementRules.snapToGrid) next = completeGridEdges(next);
  next = reconcileZoneVertices(next);
  if (!movementRules.zoneLocked) {
    next = placeSpatialActors(next, Object.fromEntries(state.actors.allIds.flatMap(id => {
      const point = state.movementRules.zoneLocked ? settledPositions[id] ?? state.actors.byId[id].spatialPosition : state.actors.byId[id].spatialPosition;
      return point ? [[id, point]] : [];
    })), true);
    return next;
  }
  const byId = { ...next.actors.byId };
  const engagements = { ...next.engagements.byId };
  const fits = (candidate: EncounterState, id: string) => movementRules.snapToGrid ? packGridZone(candidate, id).fits
    : !PolygonPlacementValidator.validate({ type: 'zone.reshape', payload: { zoneId: id, polygon: candidate.zones.byId[id]?.polygon } }, { state, nextState: candidate, mode: 'OFF' }).messages.some(message => message.severity === 'error');
  for (const id of next.engagements.allIds) {
    const engagement = engagements[id];
    if (!next.zones.byId[engagement.parentZoneId]) { delete engagements[id]; continue; }
    const candidateActors = { ...byId };
    for (const actorId of engagement.participantIds) candidateActors[actorId] = { ...candidateActors[actorId], currentZoneId: engagement.parentZoneId };
    // Groups not yet reconciled may still span Zones. Validate the current group
    // alongside settled groups, rather than failing it on a later group's draft.
    const settledGroupIds = Object.keys(engagements).filter(groupId => groupId === id || engagements[groupId].participantIds.every(actorId => candidateActors[actorId]?.currentZoneId === engagements[groupId].parentZoneId));
    const candidate = adjustPolygonFlexZonesToFit({ type: "movement.updateRules", payload: {} }, state, { ...next, actors: { ...next.actors, byId: candidateActors },
      engagements: { allIds: settledGroupIds, byId: Object.fromEntries(settledGroupIds.map(groupId => [groupId, engagements[groupId]])) } }).nextEncounter;
    if (fits(candidate, engagement.parentZoneId)) { Object.assign(byId, candidateActors); next = { ...next, zones: candidate.zones }; }
    else delete engagements[id];
  }
  for (const id of next.actors.allIds) {
    const actor = byId[id];
    byId[id] = { ...actor };
    delete byId[id].spatialPosition;
    if (!next.zones.byId[actor.currentZoneId]) byId[id].currentZoneId = ZONELESS_ACTOR_ZONE_ID;
  }
  next = { ...next, actors: { ...next.actors, byId }, engagements: { byId: engagements, allIds: next.engagements.allIds.filter(id => !!engagements[id]) } };
  next = reconcileZoneVertices(adjustPolygonFlexZonesToFit({ type: "movement.updateRules", payload: {} }, state, next).nextEncounter);
  // Stable order ensures only actors that cannot be accommodated are unplaced.
  for (const zoneId of next.zones.allIds) {
    if (fits(next, zoneId)) continue;
    const actorIds = next.actors.allIds.filter(id => byId[id].currentZoneId === zoneId);
    for (const id of actorIds.slice().reverse()) {
      byId[id] = { ...byId[id], currentZoneId: ZONELESS_ACTOR_ZONE_ID };
      for (const engagementId of next.engagements.allIds) if (engagements[engagementId]?.participantIds.includes(id)) delete engagements[engagementId];
      next = { ...next, actors: { ...next.actors, byId: { ...byId } }, engagements: { byId: { ...engagements }, allIds: next.engagements.allIds.filter(e => !!engagements[e]) } };
      if (fits(next, zoneId)) break;
    }
  }
  return next;
}
