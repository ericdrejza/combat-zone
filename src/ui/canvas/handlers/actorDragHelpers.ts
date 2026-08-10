import { setOptimisticActorPlacement } from '../actors/actorPlacementOptimisticState';
import type { ActorDragState } from '../canvasInteractionTypes';
import type { MouseUpHandlerInput } from './mouseUpTypes';

export function createSnapBackDrag(actorDrag: ActorDragState): ActorDragState {
  return {
    ...actorDrag,
    phase: 'returning',
    returnPointsByActorId: actorDrag.originPointsByActorId ?? {
      [actorDrag.actorId]: actorDrag.start
    }
  };
}

export function cacheActorDropPoints(
  actorDrag: ActorDragState,
  placements: MouseUpHandlerInput['actorRenderPlacements']
): void {
  const offset = {
    x: actorDrag.current.x - actorDrag.start.x,
    y: actorDrag.current.y - actorDrag.start.y
  };
  placements
    .filter(({ actor }) => actorDrag.actorIds.includes(actor.id))
    .forEach(({ actor, point }) => {
      const origin = actorDrag.originPointsByActorId?.[actor.id] ?? point;
      setOptimisticActorPlacement(actor.id, {
        x: origin.x + offset.x,
        y: origin.y + offset.y
      });
    });
}
