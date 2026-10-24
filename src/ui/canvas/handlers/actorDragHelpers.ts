import { setOptimisticActorPlacement } from '../actors/actorPlacementOptimisticState';
import type { ActorDragState } from '../canvasInteractionTypes';
import type { MouseUpHandlerInput } from './mouseUpTypes';
import type { LayoutPoint } from '@core/layout/types';
import type { EngagementHoverTarget } from '@ui/canvas/engagements/useEngagementHoverIntent';

/** Motion can repeat its drag callback while measuring a modifier-driven layout change. */
export function updateActorDragPoint(drag: ActorDragState | null, point: LayoutPoint, target: EngagementHoverTarget): ActorDragState | null {
  if (!drag || drag.phase !== 'dragging') return drag;
  const engagementIntentActorId = target.actorId === drag.engagementIntentActorId ? drag.engagementIntentActorId : undefined;
  const engagementIntentEngagementId = target.engagementId === drag.engagementIntentEngagementId ? drag.engagementIntentEngagementId : undefined;
  const hasMoved = drag.hasMoved || Math.hypot(drag.start.x - point.x, drag.start.y - point.y) >= 1;
  if (drag.current.x === point.x && drag.current.y === point.y && drag.hasMoved === hasMoved &&
      drag.engagementIntentActorId === engagementIntentActorId && drag.engagementIntentEngagementId === engagementIntentEngagementId) return drag;
  return { ...drag, current: point, hasMoved, engagementIntentActorId, engagementIntentEngagementId };
}

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
