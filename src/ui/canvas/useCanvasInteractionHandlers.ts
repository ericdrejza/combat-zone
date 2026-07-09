import type { CanvasInteractionState } from "./canvasInteractionTypes";
import { useCanvasClickHandlers } from "./useCanvasClickHandlers";
import { useCanvasPointerHandlers } from "./useCanvasPointerHandlers";

export function useCanvasInteractionHandlers(input: CanvasInteractionState) {
  const {
    handleCanvasClick,
    handleCanvasContextMenu,
    handleCanvasDoubleClick
  } = useCanvasClickHandlers(input);
  const {
    getDisplayedPolygon,
    handleActorMouseDown,
    handleCanvasMouseDown,
    handleCanvasMouseMove,
    handleCanvasMouseUp,
    handleResizeHandleMouseDown
  } = useCanvasPointerHandlers(input);

  return {
    getDisplayedPolygon,
    handleActorMouseDown,
    handleCanvasClick,
    handleCanvasContextMenu,
    handleCanvasDoubleClick,
    handleCanvasMouseDown,
    handleCanvasMouseMove,
    handleCanvasMouseUp,
    handleResizeHandleMouseDown
  };
}
