import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { renameEncounter } from "@core/encounter/encounterMutations";
import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { commitEncounterChange } from "@store/encounterSlice";
import type { RootState } from "@store/store";

type EncounterRenameDialogProps = {
  onClose: () => void;
};

export function EncounterRenameDialog({ onClose }: EncounterRenameDialogProps) {
  const dispatch = useDispatch();
  const encounter = useSelector((state: RootState) => state.encounter.present);
  const [name, setName] = useState(encounter.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const trimmedName = name.trim();
  const canRename = Boolean(trimmedName) && trimmedName !== encounter.name;

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  function commitRename() {
    if (!canRename) {
      return;
    }

    const nextEncounter = renameEncounter(encounter, name);

    if (nextEncounter !== encounter) {
      dispatch(
        commitEncounterChange({
          action: createEncounterActionRecord("encounter.rename", {
            name: nextEncounter.name
          }),
          nextEncounter
        })
      );
    }

    onClose();
  }

  return (
    <div
      aria-label="Rename encounter"
      aria-modal="true"
      className="viewport-overlay z-[80] flex items-center justify-center overflow-y-auto bg-black/40 p-4"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
        }
      }}
      role="dialog"
    >
      <form
        className="w-[min(24rem,calc(100vw-2rem))] space-y-4 rounded-2xl border border-canvas-line bg-canvas-panel p-5 shadow-2xl"
        onSubmit={(event) => {
          event.preventDefault();
          commitRename();
        }}
      >
        <h2 className="font-display text-lg font-semibold">Rename encounter</h2>
        <label className="block space-y-1 text-sm font-medium" htmlFor="encounter-name">
          Name
          <input
            ref={inputRef}
            aria-label="Encounter name"
            className="w-full rounded-xl border border-canvas-line bg-white px-3 py-2 font-normal outline-none focus:border-canvas-ink"
            id="encounter-name"
            onChange={(event) => setName(event.target.value)}
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
            className="rounded-xl bg-canvas-ink px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!canRename}
            type="submit"
          >
            Rename
          </button>
        </div>
      </form>
    </div>
  );
}
