import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Pencil } from "lucide-react";

import { renameEncounter } from "@core/encounter/encounterMutations";
import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { commitEncounterChange } from "@store/encounterSlice";
import type { RootState } from "@store/store";
import { TouchTooltip } from "@ui/toolbar/TouchTooltip";

type EncounterTitleProps = {
  compact?: boolean;
  name: string;
  onRename?: () => void;
  readOnly?: boolean;
};

/** Provides an inline, history-tracked rename without letting the toolbar cover the title. */
export function EncounterTitle({ compact = false, name, onRename, readOnly = false }: EncounterTitleProps) {
  const dispatch = useDispatch();
  const encounter = useSelector((state: RootState) => state.encounter.present);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  function startEditing() {
    setDraftName(name);
    setEditing(true);
  }

  function cancelEditing() {
    setDraftName(name);
    setEditing(false);
  }

  function commitEditing() {
    const trimmedName = draftName.trim();

    if (!trimmedName || trimmedName === encounter.name) {
      cancelEditing();
      return;
    }

    const nextEncounter = renameEncounter(encounter, draftName);
    dispatch(
      commitEncounterChange({
        action: createEncounterActionRecord("encounter.rename", {
          name: nextEncounter.name
        }),
        nextEncounter
      })
    );
    setEditing(false);
  }

  if (compact) {
    const renameButton = (
      <button
        aria-label={`Rename encounter ${name}`}
        className="flex h-11 min-w-11 shrink-0 items-center justify-center rounded-full border border-canvas-line bg-white px-2 text-canvas-ink shadow-sm transition hover:bg-canvas"
        disabled={readOnly}
        onClick={onRename}
        title="Rename encounter"
        type="button"
      >
        <Pencil aria-hidden="true" className="h-4 w-4" />
      </button>
    );

    return <TouchTooltip label={name}>{renameButton}</TouchTooltip>;
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        aria-label="Encounter name"
        className="relative z-[100] h-11 w-full min-w-32 rounded-lg border border-canvas-ink bg-white px-3 py-2 text-base font-semibold tracking-tight shadow-lg outline-none"
        onBlur={commitEditing}
        onChange={(event) => setDraftName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commitEditing();
          } else if (event.key === "Escape") {
            event.preventDefault();
            cancelEditing();
          }
        }}
        value={draftName}
      />
    );
  }

  return (
    <button
      aria-label={`Edit encounter name ${name}`}
      className="inline-flex max-w-full min-w-0 items-center rounded-lg px-1 py-1 text-left font-display text-xl font-semibold tracking-tight hover:bg-white/60 lg:text-2xl"
      disabled={readOnly}
      onClick={startEditing}
      title="Edit encounter name"
      type="button"
    >
      <span className="truncate">{name}</span>
    </button>
  );
}
