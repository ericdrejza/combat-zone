import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { updateActorProperties } from "@entities/actor/actorMutations";
import { commitEncounterChange } from "@store/encounterSlice";
import type { RootState } from "@store/store";

type ActorRenameModalProps = {
  onClose: () => void;
};

export function ActorRenameModal({ onClose }: ActorRenameModalProps) {
  const dispatch = useDispatch();
  const encounter = useSelector((state: RootState) => state.encounter.present);
  const selection = useSelector((state: RootState) => state.interaction.selection);
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const actorIds =
    selection.selectedEntityType === "actor" ? selection.selectedIds : [];

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function rename() {
    const nextName = name.trim();

    if (nextName) {
      const nextEncounter = actorIds.reduce(
        (currentEncounter, actorId) =>
          updateActorProperties(currentEncounter, actorId, { name: nextName }),
        encounter
      );

      if (nextEncounter !== encounter) {
        dispatch(
          commitEncounterChange({
            action: createEncounterActionRecord("actor.renameMany", {
              actorIds,
              name: nextName
            }),
            nextEncounter
          })
        );
      }
    }

    onClose();
  }

  return (
    <div
      aria-label="Rename actors"
      aria-modal="true"
      className="viewport-overlay z-[60] flex items-center justify-center overflow-y-auto bg-black/30 p-4"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
        }

        if (event.key === "Enter") {
          event.preventDefault();
          rename();
        }
      }}
      role="dialog"
    >
      <form
        className="w-[min(22rem,calc(100vw-2rem))] space-y-4 rounded-2xl border border-canvas-line bg-canvas-panel p-5 shadow-2xl"
        onSubmit={(event) => {
          event.preventDefault();
          rename();
        }}
      >
        <h2 className="font-display text-lg font-semibold">Rename actors</h2>
        <label className="block space-y-1 text-sm font-medium" htmlFor="rename-actors-name">
          Name
          <input
            ref={inputRef}
            aria-label="New actor name"
            className="w-full rounded-xl border border-canvas-line bg-white px-3 py-2 font-normal outline-none focus:border-canvas-ink"
            id="rename-actors-name"
            onChange={(event) => setName(event.target.value)}
            placeholder="Name"
            value={name}
          />
        </label>
        <div className="flex justify-end gap-2">
          <button
            className="rounded-xl border border-canvas-line bg-white px-4 py-2 text-sm font-medium transition hover:bg-canvas"
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-xl bg-canvas-ink px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
            type="submit"
          >
            Rename
          </button>
        </div>
      </form>
    </div>
  );
}
