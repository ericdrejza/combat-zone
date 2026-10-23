import type { LayoutPoint } from '@core/layout/types';
import type { ActorDragState } from '@ui/canvas/canvasInteractionTypes';

export function getDraggedPoint(
  actorId: string,
  point: LayoutPoint,
  actorDrag: ActorDragState | null
): LayoutPoint {
  if (!actorDrag?.actorIds.includes(actorId)) {
    return point;
  }

  if (actorDrag.phase === "returning") {
    return actorDrag.returnPointsByActorId?.[actorId] ?? point;
  }

  const origin = actorDrag.originPointsByActorId?.[actorId] ?? point;

  return {
    x: origin.x + actorDrag.current.x - actorDrag.start.x,
    y: origin.y + actorDrag.current.y - actorDrag.start.y
  };
}
