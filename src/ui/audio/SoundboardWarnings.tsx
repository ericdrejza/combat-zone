import { TriangleAlert } from "lucide-react";
import { useContext, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { deleteAudioCue } from "@entities/audio/audioMutations";
import { resolveLibraryAsset } from "@library/librarySlice";
import { commitEncounterChange } from "@store/encounterSlice";
import type { RootState } from "@store/store";
import { PersistenceContext } from "@ui/persistence/PersistenceContext";
import { useAudioPlayback } from "./AudioPlaybackProvider";

/** Missing-source state is derived, never persisted alongside the cue reference. */
export function SoundboardWarnings() {
  const encounter = useSelector((state: RootState) => state.encounter.present);
  const library = useSelector((state: RootState) => state.library.sections.audio);
  const missingIds = encounter.audioCues.allIds.filter((id) => !resolveLibraryAsset(library, encounter.audioCues.byId[id].libraryNodeId));
  const dispatch = useDispatch();
  const playback = useAudioPlayback();
  const { readOnly } = useContext(PersistenceContext);
  const [open, setOpen] = useState(false);
  const control = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const doc = control.current?.ownerDocument;
    const dismiss = (event: PointerEvent) => {
      if (!control.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    doc?.addEventListener("pointerdown", dismiss);
    doc?.addEventListener("keydown", escape);
    return () => { doc?.removeEventListener("pointerdown", dismiss); doc?.removeEventListener("keydown", escape); };
  }, [open]);
  useEffect(() => { if (!missingIds.length) setOpen(false); }, [missingIds.length]);
  if (!missingIds.length) return null;
  function deleteMissing() {
    if (readOnly) return;
    let nextEncounter = encounter;
    for (const id of missingIds) {
      playback.stop(id);
      nextEncounter = deleteAudioCue(nextEncounter, id);
    }
    dispatch(commitEncounterChange({ action: createEncounterActionRecord("audio.deleteUnlinkedCues", { cueIds: missingIds }), nextEncounter }));
    setOpen(false);
  }
  return <div className="relative" ref={control}>
    <button aria-label="Click to see warnings" aria-expanded={open} aria-haspopup="menu" className="flex h-7 w-7 cursor-pointer items-center justify-center text-red-600 dark:text-red-500" onClick={() => setOpen((value) => !value)} title="Click to see warnings" type="button"><TriangleAlert aria-hidden="true" className="h-4 w-4" /></button>
    {open ? <div aria-label="Soundboard warnings" className="absolute right-0 top-9 z-30 w-64 rounded-xl border border-canvas-line bg-canvas-panel p-3 shadow-xl" role="menu">
      <p className="text-sm">{missingIds.length} {missingIds.length === 1 ? "cue is" : "cues are"} without sources.</p>
      <button className="mt-3 w-full rounded-lg px-2 py-2 text-left text-sm text-red-600 hover:bg-canvas dark:text-red-500 disabled:opacity-50" disabled={readOnly} onClick={deleteMissing} role="menuitem" type="button">Delete all unlinked sound cues</button>
    </div> : null}
  </div>;
}
