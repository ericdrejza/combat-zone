import type { Actor } from '@entities/actor/types';
import type { EncounterState } from '@core/encounter/types';
import type { LayoutPoint } from '@core/layout/types';
import { gridKeyboardStep, nearestFittingAnchor, snapToGrid, spatialActorRadius } from './gridGeometry';
import type { MovementStrategy } from './types';

type SpatialStrategy = {
  place(state: EncounterState, actor: Actor, point: LayoutPoint): LayoutPoint;
  step(state: EncounterState, actor: Actor, direction: LayoutPoint): LayoutPoint;
};
const free: SpatialStrategy = {
  place: (_state, _actor, point) => ({ ...point }),
  step: (state, actor, direction) => ({ x: actor.spatialPosition!.x + direction.x * state.grid.cellSize * 10 / 64, y: actor.spatialPosition!.y + direction.y * state.grid.cellSize * 10 / 64 })
};
const grid: SpatialStrategy = {
  place: (state, actor, point) => snapToGrid(state.grid, point, actor.size),
  step: (state, actor, direction) => gridKeyboardStep(state.grid, actor.spatialPosition!, actor.size, direction)
};
export const SPATIAL_STRATEGIES = { free, grid };
export const isSpatial = (state: EncounterState) => state.movementStrategy === 'grid' || state.movementStrategy === 'free';
export function spatialPlacements(state: EncounterState) {
  return state.actors.allIds.flatMap(id => {
    const actor = state.actors.byId[id];
    return actor?.spatialPosition ? [{ actor, point: actor.spatialPosition, radius: spatialActorRadius(actor, state.grid, actor.spatialPosition) }] : [];
  });
}

/** Coordinates are authoritative outside Zone; assignments and memberships remain suspended. */
export function placeSpatialActors(state: EncounterState, points: Record<string, LayoutPoint | null>): EncounterState {
  if (!isSpatial(state)) return state;
  const strategy = SPATIAL_STRATEGIES[state.movementStrategy as 'grid' | 'free'];
  const byId = { ...state.actors.byId };
  let changed = false;
  for (const [id, point] of Object.entries(points)) {
    const actor = byId[id];
    if (!actor) continue;
    const position = point ? strategy.place(state, actor, point) : undefined;
    if (position?.x === actor.spatialPosition?.x && position?.y === actor.spatialPosition?.y) continue;
    byId[id] = { ...actor };
    if (position) byId[id].spatialPosition = position;
    else delete byId[id].spatialPosition;
    changed = true;
  }
  return changed ? { ...state, actors: { ...state.actors, byId } } : state;
}
export function stepSpatialActors(state: EncounterState, ids: string[], direction: LayoutPoint): EncounterState {
  if (!isSpatial(state)) return state;
  const strategy = SPATIAL_STRATEGIES[state.movementStrategy as 'grid' | 'free'];
  return placeSpatialActors(state, Object.fromEntries(ids.flatMap(id => {
    const actor = state.actors.byId[id];
    return actor?.spatialPosition ? [[id, strategy.step(state, actor, direction)]] : [];
  })));
}
export function resnapSpatialActors(state: EncounterState): EncounterState {
  if (state.movementStrategy !== 'grid') return state;
  return placeSpatialActors(state, Object.fromEntries(state.actors.allIds.flatMap(id => {
    const actor = state.actors.byId[id];
    return actor?.spatialPosition ? [[id, nearestFittingAnchor(state.grid, actor.spatialPosition, actor, state.canvasSize)]] : [];
  })));
}
export function changeMovementStrategy(state: EncounterState, strategy: MovementStrategy,
  settledPositions: Record<string, LayoutPoint>): EncounterState {
  if (state.movementStrategy === strategy) return state;
  let next = { ...state, movementStrategy: strategy, grid: strategy === 'grid' ? { ...state.grid, visible: true } : state.grid };
  if (strategy !== 'zone') {
    next = placeSpatialActors(next, Object.fromEntries(state.actors.allIds.flatMap(id => {
      const actor = state.actors.byId[id];
      return !actor.spatialPosition && settledPositions[id] ? [[id, settledPositions[id]]] : [];
    })));
    next = resnapSpatialActors(next);
  }
  return next;
}
