import { useEffect, useRef, useState } from "react";
import type { DragEvent } from "react";
import { useDispatch, useSelector } from "react-redux";

import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { prepareValidatedEncounterChange } from "@core/validation/validatedEncounterChange";
import { setActorDragImage } from "@core/rendering/actorDragPreview";
import { createActor } from "@entities/actor/actorMutations";
import { ACTOR_LAYOUT_GROUP_COLORS } from "@entities/actor/actorVisuals";
import { selectEntity } from "@interaction/interactionState";
import { commitEncounterChange } from "@store/encounterSlice";
import type { RootState } from "@store/store";
import { getReadableTextColor } from "../../canvas/canvasLuminance";
import {
  ACTOR_CREATION_DRAG_TYPE,
  type NewActorDragData
} from "./actorCreationDrag";

type ActorCreationModalProps = {
  onClose: () => void;
};

export function ActorCreationModal({ onClose }: ActorCreationModalProps) {
  const dispatch = useDispatch();
  const encounter = useSelector((state: RootState) => state.encounter.present);
  const actorTool = useSelector((state: RootState) => state.interaction.actorTool);
  const [name, setName] = useState("");
  const closeAfterDragRef = useRef<number | null>(null);
  const dragPreviewCleanupRef = useRef<(() => void) | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const targetZone = actorTool.targetZoneId
    ? encounter.zones.byId[actorTool.targetZoneId]
    : undefined;
  const displayName = name.trim() || "Actor";
  const colors = ACTOR_LAYOUT_GROUP_COLORS[actorTool.layoutGroup];

  useEffect(() => {
    inputRef.current?.focus();

    return () => {
      if (closeAfterDragRef.current !== null) {
        window.clearTimeout(closeAfterDragRef.current);
      }
      dragPreviewCleanupRef.current?.();
    };
  }, []);

  function create() {
    if (!targetZone) {
      return;
    }

    let actorId = `actor-${Date.now()}`;
    let suffix = 1;
    while (encounter.actors.byId[actorId]) {
      actorId = `actor-${Date.now()}-${suffix}`;
      suffix += 1;
    }

    const nextEncounter = createActor(encounter, {
      currentZoneId: targetZone.id,
      id: actorId,
      layoutGroup: actorTool.layoutGroup,
      name: displayName,
      shape: actorTool.shape,
      size: actorTool.size
    });
    const prepared = prepareValidatedEncounterChange({
      action: createEncounterActionRecord("actor.create", {
        actorId,
        destinationZoneId: targetZone.id
      }),
      currentEncounter: encounter,
      nextEncounter
    });

    if (prepared.blocked) {
      return;
    }

    dispatch(
      commitEncounterChange({
        action: prepared.action,
        nextEncounter: prepared.nextEncounter
      })
    );
    dispatch(selectEntity({ entityType: "actor", ids: [actorId] }));
    onClose();
  }

  function startDrag(event: DragEvent<HTMLSpanElement>) {
    const dragData: NewActorDragData = {
      layoutGroup: actorTool.layoutGroup,
      name: displayName,
      shape: actorTool.shape,
      size: actorTool.size
    };

    dragPreviewCleanupRef.current?.();
    dragPreviewCleanupRef.current = setActorDragImage(event.dataTransfer, {
      layoutGroup: dragData.layoutGroup,
      name: dragData.name,
      shape: dragData.shape,
      size: dragData.size
    });
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData(ACTOR_CREATION_DRAG_TYPE, JSON.stringify(dragData));
    event.dataTransfer.setData("text/plain", JSON.stringify(dragData));

    // Keep the drag source mounted until the browser has started the native
    // drag. Removing it synchronously from dragstart cancels the drag.
    closeAfterDragRef.current = window.setTimeout(onClose, 0);
  }

  return (
    <div
      aria-label="Create actor"
      aria-modal="true"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
        }
      }}
      role="dialog"
    >
      <form
        className="w-[min(22rem,calc(100vw-2rem))] space-y-4 rounded-2xl border border-canvas-line bg-canvas-panel p-5 shadow-2xl"
        onSubmit={(event) => {
          event.preventDefault();
          create();
        }}
      >
        <h2 className="font-display text-lg font-semibold">Create actor</h2>
        <div className="flex justify-center rounded-xl border border-canvas-line bg-canvas p-4">
          <span
            aria-label="Actor preview"
            className={`flex h-20 w-20 items-center justify-center overflow-hidden border-4 border-white text-center text-xs font-bold uppercase shadow-sm ${
              actorTool.shape === "rectangle" ? "rounded-xl" : "rounded-full"
            }`}
            data-actor-preview="true"
            draggable
            onDragStart={startDrag}
            style={{
              backgroundColor: colors.fill,
              color: getReadableTextColor(colors.fill)
            }}
          >
            {displayName}
          </span>
        </div>
        <label className="block space-y-1 text-sm font-medium" htmlFor="create-actor-name">
          Name
          <input
            ref={inputRef}
            aria-label="Actor name"
            className="w-full rounded-xl border border-canvas-line bg-white px-3 py-2 font-normal outline-none focus:border-canvas-ink"
            id="create-actor-name"
            onChange={(event) => setName(event.target.value)}
            placeholder="Name"
            value={name}
          />
        </label>
        {targetZone ? null : (
          <p className="text-center text-sm text-canvas-muted">Drag actor to zone</p>
        )}
        <div className="flex justify-end gap-2">
          <button
            className="rounded-xl border border-canvas-line bg-white px-4 py-2 text-sm font-medium transition hover:bg-canvas"
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          {targetZone ? (
            <button
              className="rounded-xl bg-canvas-ink px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
              type="submit"
            >
              Create
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}
