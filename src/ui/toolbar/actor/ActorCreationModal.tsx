import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { prepareValidatedEncounterChangeForRuntime } from "@core/validation/validatedEncounterChange";
import { createActor } from "@entities/actor/actorMutations";
import { ACTOR_LAYOUT_GROUP_COLORS } from "@entities/actor/actorVisuals";
import { selectEntity } from "@interaction/interactionState";
import { commitEncounterChange } from "@store/encounterSlice";
import { logEncounterValidationBlock } from "@store/encounterLogSlice";
import type { RootState } from "@store/store";
import { armCompactCanvasTransfer } from "@ui/canvas/compactCanvasTransfer";
import { getReadableTextColor } from "../../canvas/canvasLuminance";
import type { NewActorDragData } from "./actorCreationDrag";

type ActorCreationModalProps = {
  onClose: () => void;
};

export function ActorCreationModal({ onClose }: ActorCreationModalProps) {
  const dispatch = useDispatch();
  const encounter = useSelector((state: RootState) => state.encounter.present);
  const actorTool = useSelector((state: RootState) => state.interaction.actorTool);
  const [name, setName] = useState("");
  const [transferActive, setTransferActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const targetZone = actorTool.targetZoneId
    ? encounter.zones.byId[actorTool.targetZoneId]
    : undefined;
  const displayName = name.trim() || "Actor";
  const colors = ACTOR_LAYOUT_GROUP_COLORS[actorTool.layoutGroup];

  useEffect(() => {
    inputRef.current?.focus();
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
    const prepared = prepareValidatedEncounterChangeForRuntime({
      action: createEncounterActionRecord("actor.create", {
        actorId,
        destinationZoneId: targetZone.id
      }),
      currentEncounter: encounter,
      nextEncounter
    });

    const commitPrepared = (resolved: Awaited<typeof prepared>) => {
      if (resolved.blocked) {
        logEncounterValidationBlock(dispatch, resolved);
        return;
      }

      dispatch(
        commitEncounterChange({
          action: resolved.action,
          nextEncounter: resolved.nextEncounter
        })
      );
      dispatch(selectEntity({ entityType: "actor", ids: [actorId] }));
      onClose();
    };

    if (prepared instanceof Promise) {
      void prepared.then(commitPrepared);
    } else {
      commitPrepared(prepared);
    }
  }

  function getDragData(): NewActorDragData {
    return {
      layoutGroup: actorTool.layoutGroup,
      name: displayName,
      shape: actorTool.shape,
      size: actorTool.size
    };
  }

  return (
    <div
      aria-label="Create actor"
      aria-modal="true"
      aria-hidden={transferActive || undefined}
      className={`fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4 ${
        transferActive ? "pointer-events-none opacity-0" : ""
      }`}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
        }
      }}
      role={transferActive ? undefined : "dialog"}
    >
      <form
        className="w-[min(22rem,calc(100vw-2rem))] space-y-4 rounded-2xl border border-canvas-line bg-canvas-panel p-5 shadow-2xl"
        onSubmit={(event) => {
          event.preventDefault();
          void create();
        }}
      >
        <h2 className="font-display text-lg font-semibold">Create actor</h2>
        <div className="flex justify-center rounded-xl border border-canvas-line bg-canvas p-4">
          <span
            aria-label="Actor preview"
            className={`flex h-20 w-20 touch-none cursor-grab select-none items-center justify-center overflow-hidden border-4 border-white text-center text-xs font-bold uppercase shadow-sm active:cursor-grabbing ${
              actorTool.shape === "rectangle" ? "rounded-xl" : "rounded-full"
            } ${transferActive ? "pointer-events-auto" : ""}`}
            data-actor-preview="true"
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture?.(event.pointerId);
              armCompactCanvasTransfer(
                event.nativeEvent,
                { actor: getDragData(), kind: "new-actor" },
                () => setTransferActive(true),
                "all",
                onClose
              );
            }}
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
