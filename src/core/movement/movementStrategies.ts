import type { Actor } from '@entities/actor/types';
import type { EncounterState } from '@core/encounter/types';
import type { LayoutPoint } from '@core/layout/types';
import { resolveGridGeometry } from './gridScale';
import { gridKeyboardStep, snapToGrid, spatialActorRadius, footprintFits } from './gridGeometry';
import { anchorKey, canvasAnchors, pointDistance, pointOrder } from './gridTopology';
import { attachFixedEngagementTokens } from './gridZonePacking';

export const isSpatial = (state: EncounterState) => !state.movementRules.zoneLocked;
export function spatialPlacements(state: EncounterState) {
  return attachFixedEngagementTokens(state, state.actors.allIds.flatMap(id => {
    const actor = state.actors.byId[id];
    return actor?.spatialPosition ? [{ actorId: id, point: actor.spatialPosition, radius: spatialActorRadius(actor) }] : [];
  })).map(placement => ({ ...placement, actor: state.actors.byId[placement.actorId] }));
}

function fittingPoint(state: EncounterState, actor: Actor, requested: LayoutPoint, occupied: Set<string>): LayoutPoint | undefined {
  const snapped = snapToGrid(resolveGridGeometry(state.grid), requested, actor.size);
  const fits = (point: LayoutPoint) => footprintFits(point, spatialActorRadius(actor), state.canvasSize) && (state.movementRules.allowOverlap || !occupied.has(anchorKey(point)));
  if (state.movementRules.allowOverlap || !occupied.has(anchorKey(snapped))) return snapped;
  return canvasAnchors(state, actor.size).filter(fits).sort((a, b) => pointDistance(a, requested) - pointDistance(b, requested) || pointOrder(a, b))[0];
}

/** A multi-actor move reserves anchors deterministically and fails as a whole. */
export function placeSpatialActors(state: EncounterState, points: Record<string, LayoutPoint | null>, unplaceOnFailure = false): EncounterState {
  if (!isSpatial(state)) return state;
  const occupied = new Set(state.actors.allIds.flatMap(id => !(id in points) && state.actors.byId[id].spatialPosition ? [anchorKey(state.actors.byId[id].spatialPosition!)] : []));
  const byId = { ...state.actors.byId };
  let changed = false;
  for (const id of state.actors.allIds.filter(actorId => actorId in points)) {
    const actor = byId[id], point = points[id];
    const position = point ? state.movementRules.snapToGrid ? fittingPoint(state, actor, point, occupied) : { ...point } : undefined;
    if (point && !position && !unplaceOnFailure) return state;
    if (unplaceOnFailure && position && !footprintFits(position, spatialActorRadius(actor), state.canvasSize)) {
      byId[id] = { ...actor }; delete byId[id].spatialPosition; changed = true; continue;
    }
    if (position) occupied.add(anchorKey(position));
    if (position?.x === actor.spatialPosition?.x && position?.y === actor.spatialPosition?.y) continue;
    byId[id] = { ...actor };
    if (position) byId[id].spatialPosition = position;
    else delete byId[id].spatialPosition;
    changed = true;
  }
  return changed ? { ...state, actors: { ...state.actors, byId } } : state;
}
export function spatialStepTargets(state: EncounterState, ids: string[], direction: LayoutPoint): Record<string, LayoutPoint> {
  return Object.fromEntries(ids.flatMap(id => {
    const actor = state.actors.byId[id], point = actor?.spatialPosition;
    if (!point) return [];
    const target = state.movementRules.snapToGrid ? gridKeyboardStep(resolveGridGeometry(state.grid), point, actor.size, direction)
      : { x: point.x + direction.x * 10, y: point.y + direction.y * 10 };
    return [[id, target]];
  }));
}
export function stepSpatialActors(state: EncounterState, ids: string[], direction: LayoutPoint): EncounterState {
  if (!isSpatial(state)) return state;
  return placeSpatialActors(state, spatialStepTargets(state, ids, direction));
}
export function resnapSpatialActors(state: EncounterState): EncounterState {
  if (!isSpatial(state) || !state.movementRules.snapToGrid) return state;
  return placeSpatialActors(state, Object.fromEntries(state.actors.allIds.flatMap(id => {
    const actor = state.actors.byId[id]; return actor.spatialPosition ? [[id, actor.spatialPosition]] : [];
  })));
}
