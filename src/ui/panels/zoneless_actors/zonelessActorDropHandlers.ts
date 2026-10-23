import type { DragEvent } from "react";
import { useDispatch, useSelector } from "react-redux";
import { ZONELESS_ACTOR_ZONE_ID } from "@core/encounter/types";
import type { ToolId } from "@interaction/tools/toolRegistry";
import type { AppDispatch, RootState } from "@store/store";
import { commitActorFromCreation } from "@ui/canvas/canvasDropMutations";
import { ACTOR_CREATION_DRAG_TYPE, type NewActorDragData } from "@ui/toolbar/actor/actorCreationDrag";
import { hasZonelessActorDrag } from "./zonelessActorDrag";

type Context = Parameters<typeof commitActorFromCreation>[0];

/** All Zoneless presentations accept the same creation drops and preserve internal transfers. */
export function createZonelessActorDropHandlers(context: Context, tool: ToolId) {
  function handleActorCreationDropToZoneless(event: DragEvent<HTMLElement>) {
    if (hasZonelessActorDrag(event)) { event.preventDefault(); event.stopPropagation(); return; }
    if (tool !== "actor") return;
    const payload = event.dataTransfer.getData(ACTOR_CREATION_DRAG_TYPE);
    if (!payload) return;
    event.preventDefault();
    try {
      commitActorFromCreation(context, JSON.parse(payload) as NewActorDragData, ZONELESS_ACTOR_ZONE_ID);
    } catch {
      // Ignore malformed external drag payloads.
    }
  }
  function handleActorCreationDragOverZoneless(event: DragEvent<HTMLElement>) {
    if (hasZonelessActorDrag(event)) {
      event.preventDefault(); event.dataTransfer.dropEffect = "move"; return;
    }
    if (tool !== "actor" || !Array.from(event.dataTransfer.types).includes(ACTOR_CREATION_DRAG_TYPE)) return;
    event.preventDefault(); event.dataTransfer.dropEffect = "copy";
  }
  return { handleActorCreationDropToZoneless, handleActorCreationDragOverZoneless };
}

export function useZonelessActorDropHandlers() {
  const dispatch = useDispatch<AppDispatch>();
  const encounter = useSelector((state: RootState) => state.encounter.present);
  const library = useSelector((state: RootState) => state.library);
  const actorTool = useSelector((state: RootState) => state.interaction.actorTool);
  const tool = useSelector((state: RootState) => state.interaction.activeToolId);
  return createZonelessActorDropHandlers({ dispatch, encounter, library, actorTool }, tool);
}
