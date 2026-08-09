import type { RootState } from "@store/store";
import type { ActorDragState } from "./canvasInteractionTypes";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "./canvasConstants";
import type { ActorRenderPlacement } from "./actors/actorCanvasLayout";
import { EngagementDragPreview } from './engagements/EngagementDragPreview';
import { EngagementIntentPreview } from './engagements/EngagementIntentPreview';

type CanvasDragOverlayProps = {
  actorDrag: ActorDragState;
  actorRenderPlacements: ActorRenderPlacement[];
  encounter: RootState["encounter"]["present"];
};

export function CanvasDragOverlay({
  actorDrag,
  actorRenderPlacements,
  encounter
}: CanvasDragOverlayProps) {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-30 h-full w-full"
      data-drag-overlay="actor"
      viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
    >
      <EngagementDragPreview actorDrag={actorDrag} encounter={encounter} placements={actorRenderPlacements} />
      <EngagementIntentPreview actorDrag={actorDrag} encounter={encounter} placements={actorRenderPlacements} />
    </svg>
  );
}
