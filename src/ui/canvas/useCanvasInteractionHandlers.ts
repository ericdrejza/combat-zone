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
    handleResizeHandleDrag,
    handleResizeHandleDragEnd,
    handleCanvasMouseDown,
    handleCanvasMouseMove,
    handleCanvasMouseUp,
    handleResizeHandleMouseDown,
    handleZoneDrag,
    handleZoneDragEnd
  } = useCanvasPointerHandlers(input);

  return {
    getDisplayedPolygon,
    handleActorDrag,
    handleActorDragEnd,
    handleActorDragStart,
    handleResizeHandleDrag,
    handleResizeHandleDragEnd,
    handleCanvasClick,
    handleCanvasContextMenu,
    handleCanvasDoubleClick,
    handleCanvasMouseDown,
    handleCanvasMouseMove,
    handleCanvasMouseUp,
    handleResizeHandleMouseDown,
    handleZoneDrag,
    handleZoneDragEnd
  };
}
