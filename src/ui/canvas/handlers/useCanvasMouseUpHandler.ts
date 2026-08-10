import { handleActorMouseUp } from './actorMouseUp';
import { handleSelectionMouseUp } from './selectionMouseUp';
import { handleZoneMouseUp } from './zoneMouseUp';
import type { MouseUpHandlerInput } from './mouseUpTypes';

/** Compose the interaction-specific mouse-up finalizers in canvas priority order. */
export function useCanvasMouseUpHandler(input: MouseUpHandlerInput) {
  function handleCanvasMouseUp() {
    if (handleActorMouseUp(input)) return;
    if (handleSelectionMouseUp(input)) return;
    handleZoneMouseUp(input);
  }

  return handleCanvasMouseUp;
}
