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
    handleActorDrag,
    handleActorDragEnd,
    handleActorDragStart,
    handleCanvasMouseDown,
    handleCanvasMouseMove,
    handleCanvasMouseUp,
    handleResizeHandleMouseDown
  } = useCanvasPointerHandlers(input);

  return {
    getDisplayedPolygon,
    handleActorDrag,
    handleActorDragEnd,
    handleActorDragStart,
    handleCanvasClick,
    handleCanvasContextMenu,
    handleCanvasDoubleClick,
    handleCanvasMouseDown,
    handleCanvasMouseMove,
    handleCanvasMouseUp,
    handleResizeHandleMouseDown
  };
}
