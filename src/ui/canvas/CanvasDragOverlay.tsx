import type { RootState } from "@store/store";
import type { ActorDragState } from "./canvasInteractionTypes";
import { ActorLayer } from "./ActorLayer";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "./canvasConstants";

type CanvasDragOverlayProps = {
  actorDrag: ActorDragState;
  backgroundLuminanceByZoneId: Record<string, number>;
  canvasBackgroundLuminance: number;
  encounter: RootState["encounter"]["present"];
  selection: RootState["interaction"]["selection"];
  showFactionOutlines: boolean;
};

export function CanvasDragOverlay({
  actorDrag,
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
        backgroundLuminanceByZoneId={backgroundLuminanceByZoneId}
        canvasBackgroundLuminance={canvasBackgroundLuminance}
        dragOverlay
        encounter={encounter}
        onActorMouseDown={() => undefined}
        onActorMouseEnter={() => undefined}
        onActorMouseLeave={() => undefined}
        selection={selection}
        showFactionOutlines={showFactionOutlines}
      />
    </svg>
  );
}
