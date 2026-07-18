import type { RootState } from "@store/store";
import type { ActorDragState } from "./canvasInteractionTypes";
import { ActorLayer } from "./actors/ActorLayer";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "./canvasConstants";
import type { ActorRenderPlacement } from "./actors/actorCanvasLayout";

type CanvasDragOverlayProps = {
  actorDrag: ActorDragState;
  actorRenderPlacements: ActorRenderPlacement[];
  backgroundLuminanceByZoneId: Record<string, number>;
  canvasBackgroundLuminance: number;
  encounter: RootState["encounter"]["present"];
  selection: RootState["interaction"]["selection"];
  showFactionOutlines: boolean;
};

export function CanvasDragOverlay({
  actorDrag,
  actorRenderPlacements,
  backgroundLuminanceByZoneId,
  canvasBackgroundLuminance,
  encounter,
  selection,
  showFactionOutlines
}: CanvasDragOverlayProps) {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-30 h-full w-full"
      data-drag-overlay="actor"
      viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
    >
      <ActorLayer
        actorDrag={actorDrag}
        placements={actorRenderPlacements}
        zoneActorTranslation={null}
        backgroundLuminanceByZoneId={backgroundLuminanceByZoneId}
        canvasBackgroundLuminance={canvasBackgroundLuminance}
        dragOverlay
        encounter={encounter}
        onActorMouseEnter={() => undefined}
        onActorMouseLeave={() => undefined}
        selection={selection}
        showFactionOutlines={showFactionOutlines}
      />
    </svg>
  );
}
