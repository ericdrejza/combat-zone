import { useEffect, useMemo, useRef } from "react";
import type { DragEvent, MouseEvent, PointerEvent } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setActorDragImage } from "@core/rendering/actorDragPreview";
import type { Actor } from "@entities/actor/types";
import { selectEntity } from "@interaction/interactionState";
import type { RootState } from "@store/store";
import { armCompactCanvasTransfer } from "@ui/canvas/compactCanvasTransfer";
import { getGroupedActors, getZonelessActors } from "./zonelessActorGroups";
import { getZonelessActorTextPayload, ZONELESS_ACTOR_DRAG_TYPE } from "./zonelessActorDrag";

/** Both presentations select and transfer the same authoritative panel collection. */
export function useZonelessPanelActors() {
  const dispatch = useDispatch();
  const actors = useSelector((s: RootState) => s.encounter.present.actors);
  const zoneLocked = useSelector((s: RootState) => s.encounter.present.movementRules.zoneLocked);
  const activeTool = useSelector((s: RootState) => s.interaction.activeToolId);
  const selection = useSelector((s: RootState) => s.interaction.selection);
  const touchMultiSelect = useSelector((s: RootState) => s.interaction.touchMultiSelect);
  const cleanupRef = useRef<(() => void) | null>(null);
  const suppressClickRef = useRef(false);
  const zonelessActors = useMemo(() => getZonelessActors(actors, zoneLocked), [actors, zoneLocked]);
  const groups = useMemo(() => getGroupedActors(zonelessActors), [zonelessActors]);
  const canSelect = ["actor", "select", "grid"].includes(activeTool);
  const selectedIds = selection.selectedEntityType === "actor" ? selection.selectedIds : [];
  const transferIds = (id: string) => selectedIds.includes(id)
    ? zonelessActors.filter(actor => selectedIds.includes(actor.id)).map(actor => actor.id)
    : [id];

  useEffect(() => () => cleanupRef.current?.(), []);

  function selectActors(group: Actor[]) {
    if (!canSelect || !group.length) return;
    dispatch(selectEntity({
      entityType: "actor",
      ids: group.map(actor => actor.id),
      userInitiated: true
    }));
  }

  function handleSelect(id: string, event: MouseEvent<HTMLButtonElement>) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (!canSelect) return;
    dispatch(selectEntity({
      entityType: "actor",
      ids: [id],
      toggle: touchMultiSelect || event.shiftKey || event.ctrlKey || event.metaKey,
      userInitiated: true
    }));
  }

  function handleDragStart(id: string, event: DragEvent<HTMLButtonElement>) {
    if (!canSelect) {
      event.preventDefault();
      return;
    }
    const actor = actors.byId[id];
    cleanupRef.current?.();
    cleanupRef.current = setActorDragImage(event.dataTransfer, actor);
    const ids = transferIds(id);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(ZONELESS_ACTOR_DRAG_TYPE, ids.join(","));
    event.dataTransfer.setData("text/plain", getZonelessActorTextPayload(ids));
  }

  function handleDragEnd() {
    cleanupRef.current?.();
    cleanupRef.current = null;
  }

  function startPointerTransfer(id: string, event: PointerEvent<HTMLButtonElement>) {
    suppressClickRef.current = false;
    if (!canSelect) return;
    const actor = zonelessActors.find(candidate => candidate.id === id);
    if (!actor) return;
    armCompactCanvasTransfer(
      event.nativeEvent,
      { actor, actorIds: transferIds(id), kind: "zoneless-actors" },
      () => { suppressClickRef.current = true; },
      "all"
    );
  }

  return {
    zonelessActors, groups, selectedIds, canSelect, selectActors,
    handleSelect, handleDragStart, handleDragEnd, startPointerTransfer
  };
}
