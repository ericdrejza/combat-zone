import type { DragEvent, MouseEvent } from "react";
import { useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setActorDragImage } from "@core/rendering/actorDragPreview";
import { selectEntity } from "@interaction/interactionState";
import type { RootState } from "@store/store";
import { ZonelessActorPanelToken } from "./ZonelessActorPanelToken";
import {
  getGroupedActors,
  getZonelessActors
} from "./ZonelessActorPanel";
import {
  getZonelessActorTextPayload,
  ZONELESS_ACTOR_DRAG_TYPE
} from "./zonelessActorDrag";
import { armCompactCanvasTransfer } from "@ui/canvas/compactCanvasTransfer";

/** Drawer presentation of the authoritative zoneless actor collection. */
export function CompactZonelessActorPanel() {
  const dispatch = useDispatch();
  const actors = useSelector((state: RootState) => state.encounter.present.actors);
  const activeToolId = useSelector(
    (state: RootState) => state.interaction.activeToolId
  );
  const selection = useSelector((state: RootState) => state.interaction.selection);
  const touchMultiSelect = useSelector(
    (state: RootState) => state.interaction.touchMultiSelect
  );
  const [groupByFaction, setGroupByFaction] = useState(true);
  const dragPreviewCleanupRef = useRef<(() => void) | null>(null);
  const zonelessActors = useMemo(() => getZonelessActors(actors), [actors]);
  const groups = useMemo(() => getGroupedActors(zonelessActors), [zonelessActors]);
  const selectedIds =
    selection.selectedEntityType === "actor" ? selection.selectedIds : [];

  function selectActor(actorId: string, event: MouseEvent<HTMLButtonElement>) {
    if (activeToolId !== "actor" && activeToolId !== "select") {
      return;
    }

    dispatch(
      selectEntity({
        entityType: "actor",
        ids: [actorId],
        toggle:
          touchMultiSelect || event.shiftKey || event.ctrlKey || event.metaKey
      })
    );
  }

  function startDrag(actorId: string, event: DragEvent<HTMLButtonElement>) {
    if (activeToolId !== "actor" && activeToolId !== "select") {
      event.preventDefault();
      return;
    }

    const actorIds = selectedIds.includes(actorId) ? selectedIds : [actorId];
    const actor = zonelessActors.find((candidate) => candidate.id === actorId);

    if (actor) {
      dragPreviewCleanupRef.current?.();
      dragPreviewCleanupRef.current = setActorDragImage(event.dataTransfer, {
        image: actor.image,
        layoutGroup: actor.layoutGroup,
        name: actor.name,
        shape: actor.shape,
        size: actor.size
      });
    }

    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(ZONELESS_ACTOR_DRAG_TYPE, actorIds.join(","));
    event.dataTransfer.setData("text/plain", getZonelessActorTextPayload(actorIds));
  }

  function finishDrag() {
    dragPreviewCleanupRef.current?.();
    dragPreviewCleanupRef.current = null;
  }

  function renderActors(actorIds: typeof zonelessActors) {
    return actorIds.map((actor) => (
      <ZonelessActorPanelToken
        actor={actor}
        key={actor.id}
        onDragEnd={finishDrag}
        onDragStart={startDrag}
        onPointerDown={(actorId, event) => {
          const actorIds = selectedIds.includes(actorId)
            ? selectedIds
            : [actorId];
          armCompactCanvasTransfer(event.nativeEvent, {
            actor,
            actorIds,
            kind: "zoneless-actors"
          }, undefined, "all");
        }}
        onSelect={selectActor}
        selectedIds={selectedIds}
      />
    ));
  }

  return (
    <div className="space-y-3">
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input
          aria-label="Group by faction"
          checked={groupByFaction}
          className="h-5 w-5 accent-canvas-ink"
          onChange={(event) => setGroupByFaction(event.target.checked)}
          type="checkbox"
        />
        Group by faction
      </label>
      {zonelessActors.length === 0 ? (
        <p className="rounded-xl border border-dashed border-canvas-line px-3 py-5 text-center text-sm text-canvas-muted">
          Drop actors here to remove them from the canvas.
        </p>
      ) : groupByFaction ? (
        <div className="space-y-3">
          {groups.map((group) => (
            <section aria-label={`${group.label} zoneless actors`} key={group.id}>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-canvas-muted">
                {group.label}
              </h3>
              <div className="flex flex-wrap gap-1">{renderActors(group.actors)}</div>
            </section>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-1">{renderActors(zonelessActors)}</div>
      )}
    </div>
  );
}
