import type { RootState } from "@store/store";
import type { ActorDragState } from "./canvasInteractionTypes";
import type { CanvasSize } from "@core/layout/polygonCanvasBounds";
import type { ActorRenderPlacement } from "./actors/actorCanvasLayout";
import { EngagementDragPreview } from './engagements/EngagementDragPreview';
import { EngagementIntentPreview } from './engagements/EngagementIntentPreview';

type CanvasDragOverlayProps = {
  actorDrag: ActorDragState;
  actorRenderPlacements: ActorRenderPlacement[];
  canvasSize: CanvasSize;
  encounter: RootState["encounter"]["present"];
};

export function CanvasDragOverlay({
  actorDrag,
  actorRenderPlacements,
  canvasSize,
  encounter
}: CanvasDragOverlayProps) {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-30 h-full w-full"
      data-drag-overlay="actor"
      viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`}
    >
      <EngagementDragPreview actorDrag={actorDrag} encounter={encounter} placements={actorRenderPlacements} />
      <EngagementIntentPreview actorDrag={actorDrag} encounter={encounter} placements={actorRenderPlacements} />
    </svg>
  );
}
