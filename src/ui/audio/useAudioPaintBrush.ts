import { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";

import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { prepareValidatedEncounterChangeForRuntime } from "@core/validation/runtimeEncounterChange";
import { setEntityAudioGroups } from "@entities/audio/audioMutations";
import { clearAudioPaintBrush } from "@interaction/interactionState";
import { consumeEncounterChange } from "@store/consumeEncounterChange";
import { commitEncounterChange } from "@store/encounterSlice";
import { logEncounterValidationBlock } from "@store/encounterLogSlice";
import type { AppDispatch, RootState } from "@store/store";
import { useZoneResizeApproval } from "@ui/zoneResizeApproval";

/** Selection drives painting once; history replay must never reapply the brush. */
export function useAudioPaintBrush() {
  const dispatch = useDispatch<AppDispatch>();
  const encounter = useSelector((state: RootState) => state.encounter.present);
  const { audioPaintBrush: brush, selection } = useSelector((state: RootState) => state.interaction);
  const lastTrigger = useRef<string>();
  const { requestApproval } = useZoneResizeApproval();
  useEffect(() => {
    if (!brush) return;
    const cancel = (event: KeyboardEvent | MouseEvent) => {
      if (event.type === "contextmenu" || (event as KeyboardEvent).key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        dispatch(clearAudioPaintBrush());
      }
    };
    window.addEventListener("keydown", cancel, true);
    window.addEventListener("contextmenu", cancel, true);
    return () => {
      window.removeEventListener("keydown", cancel, true);
      window.removeEventListener("contextmenu", cancel, true);
    };
  }, [brush, dispatch]);
  useEffect(() => {
    const trigger = JSON.stringify([brush, selection.selectedEntityType, selection.selectedIds]);
    if (trigger === lastTrigger.current) return;
    lastTrigger.current = trigger;
    if (!brush || selection.selectedEntityType !== brush.entityType) return;
    const entities = brush.entityType === "actor" ? encounter.actors : encounter.zones;
    const source = entities.byId[brush.entityId];
    if (!source) { dispatch(clearAudioPaintBrush()); return; }
    const groupIds = (source.audioGroupIds ?? []).filter((id) => encounter.audioCueGroups.byId[id]?.section === brush.entityType);
    const targetIds = selection.selectedIds.filter((id) => entities.byId[id] && JSON.stringify(entities.byId[id].audioGroupIds ?? []) !== JSON.stringify(groupIds));
    if (!targetIds.length) return;
    const nextEncounter = targetIds.reduce((state, id) => setEntityAudioGroups(state, brush.entityType, id, groupIds), encounter);
    const prepared = prepareValidatedEncounterChangeForRuntime({
      action: createEncounterActionRecord("audio.paintGroups", { entityType: brush.entityType, entityIds: targetIds, groupIds }),
      currentEncounter: encounter, nextEncounter
    });
    void consumeEncounterChange(prepared, encounter, dispatch, (resolved) => {
      if (logEncounterValidationBlock(dispatch, resolved)) return;
      const commit = () => { dispatch(commitEncounterChange({ action: resolved.action, nextEncounter: resolved.nextEncounter })); };
      if (resolved.requiresConfirmation) requestApproval({ onApprove: () => { void consumeEncounterChange(resolved, encounter, dispatch, commit); } });
      else if (!resolved.blocked) commit();
    });
  }, [brush, dispatch, encounter, requestApproval, selection]);
}
