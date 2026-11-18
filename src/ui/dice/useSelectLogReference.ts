import { useStore } from "react-redux";
import type { RootState } from "@store/store";
import { selectEntity, setActiveTool, setAudioSectionType } from "@interaction/interactionState";
import { canToolSelectEntityType } from "@interaction/tools/toolRegistry";
import { useCanvasEntityNavigation } from "@ui/canvas/useCanvasEntityNavigation";
import { revealZonelessActor } from "@ui/panels/zoneless_actors/zonelessActorReveal";

/** Log clicks are selection intents, like Initiative and audio member badges, regardless of drawing tool. */
export function useSelectLogReference() {
  const store = useStore<RootState>();
  const navigateCanvas = useCanvasEntityNavigation();
  return (kind: "actor" | "zone", requestedIds: readonly string[], { group = false, navigate = false }: { group?: boolean; navigate?: boolean } = {}) => {
    const { encounter, interaction } = store.getState();
    const collection = kind === "actor" ? encounter.present.actors : encounter.present.zones;
    const ids = Array.from(new Set(requestedIds)).filter(id => !!collection.byId[id]);
    // A stale/empty reference must not change either selection or the active tool.
    if (!ids.length) return;
    if (interaction.activeToolId === "audio") {
      if (interaction.audioTool.sectionType !== kind) store.dispatch(setAudioSectionType(kind));
    } else if (!canToolSelectEntityType(interaction.activeToolId, kind)) store.dispatch(setActiveTool("select"));
    store.dispatch(selectEntity({ entityType: kind, ids, userInitiated: true }));
    if (!navigate) return;
    const selected = store.getState();
    if (selected.interaction.selection.selectedEntityType !== kind) return;
    const zoneless = kind === "actor" ? ids.find(id => encounter.present.movementRules.zoneLocked
      ? encounter.present.actors.byId[id].currentZoneId === "zoneless" : !encounter.present.actors.byId[id].spatialPosition) : undefined;
    if (zoneless) revealZonelessActor(zoneless, selected.encounterLog.encounterSession);
    if (!zoneless || group) navigateCanvas(kind, group ? ids : ids[0]);
  };
}
