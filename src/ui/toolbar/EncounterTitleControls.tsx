import { Lock, SaveCheck, SavePen, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { prepareValidatedEncounterChangeForRuntime } from "@core/validation/validatedEncounterChange";
import { commitEncounterChange } from "@store/encounterSlice";
import { logEncounterValidationBlock } from "@store/encounterLogSlice";
import type { RootState } from "@store/store";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

type EncounterTitleControlsProps = {
  hasSavedEncounter?: boolean;
  onSave: () => void;
  readOnly: boolean;
  saveStatus: SaveStatus;
  showTitle?: boolean;
};

export function EncounterTitleControls({
  hasSavedEncounter = false,
  onSave,
  readOnly,
  saveStatus,
  showTitle = true
}: EncounterTitleControlsProps) {
  const dispatch = useDispatch();
  const encounter = useSelector((state: RootState) => state.encounter.present);
  const [draftName, setDraftName] = useState(encounter.name);

  useEffect(() => setDraftName(encounter.name), [encounter.id, encounter.name]);

  function commitName() {
    const name = draftName.trim();
    if (readOnly || !name || name === encounter.name) {
      setDraftName(encounter.name);
      return;
    }

    const prepared = prepareValidatedEncounterChangeForRuntime({
      action: createEncounterActionRecord("encounter.rename", { name }),
      currentEncounter: encounter,
      nextEncounter: { ...encounter, name }
    });
    const commitPrepared = (resolved: Awaited<typeof prepared>) => {
      if (resolved.blocked) {
        logEncounterValidationBlock(dispatch, resolved);
        setDraftName(encounter.name);
        return;
      }
      dispatch(
        commitEncounterChange({
          action: resolved.action,
          nextEncounter: resolved.nextEncounter
        })
      );
    };

    if (prepared instanceof Promise) {
      void prepared.then(commitPrepared);
    } else {
      commitPrepared(prepared);
    }
  }

  const SaveIcon =
    saveStatus === "error"
      ? TriangleAlert
      : hasSavedEncounter
        ? SaveCheck
        : SavePen;

  return (
    <div className={`mr-2 flex shrink items-center gap-2 ${showTitle ? "min-w-[12rem] max-w-[22rem]" : ""}`}>
      {showTitle ? <input
        aria-label="Encounter name"
        className="min-w-0 flex-1 border-b border-transparent bg-transparent px-1 font-display text-xl font-semibold tracking-tight outline-none transition hover:border-canvas-line focus:border-canvas-ink disabled:cursor-not-allowed"
        disabled={readOnly}
        onBlur={commitName}
        onChange={(event) => setDraftName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          } else if (event.key === "Escape") {
            setDraftName(encounter.name);
            event.currentTarget.blur();
          }
        }}
        value={draftName}
      /> : null}
      <button
        aria-label="Save encounter"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-canvas-line bg-white text-canvas-ink transition hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-50"
        disabled={readOnly || saveStatus === "saving"}
        onClick={onSave}
        title={
          saveStatus === "error"
            ? "Save failed—try again"
            : hasSavedEncounter
              ? "Save encounter (Ctrl/Cmd+S)"
              : "Save encounter to Library (Ctrl/Cmd+S)"
        }
        type="button"
      >
        <SaveIcon aria-hidden="true" className="h-4 w-4" />
      </button>
      {readOnly ? (
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900" role="status">
          <Lock aria-hidden="true" className="h-3.5 w-3.5" />
          Read-only—open in another tab
        </span>
      ) : null}
    </div>
  );
}
