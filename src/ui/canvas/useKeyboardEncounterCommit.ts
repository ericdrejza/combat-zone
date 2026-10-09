import { useStore } from "react-redux";
import type { EncounterState } from "@core/encounter/types";
import type { JsonObject } from "@core/history/types";
import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { prepareValidatedEncounterChangeForRuntime } from "@core/validation/validatedEncounterChange";
import { commitEncounterChange } from "@store/encounterSlice";
import { logEncounterValidationBlock } from "@store/encounterLogSlice";
import { isPersistenceWritable } from "@store/persistenceWriteGuardMiddleware";
import type { RootState } from "@store/store";
import { useZoneResizeApproval } from "@ui/zoneResizeApproval";

/** Keyboard drafts may never replace a newer snapshot or bypass the writer boundary. */
export function useKeyboardEncounterCommit() {
  const store = useStore<RootState>();
  const { requestApproval } = useZoneResizeApproval();
  return async (type: string, payload: JsonObject, mutate: (state: EncounterState) => EncounterState,
    isCurrent: () => boolean = () => true, onCommit?: () => void): Promise<boolean> => {
    if (!isPersistenceWritable() || !isCurrent()) return false;
    const current = store.getState().encounter.present;
    const next = mutate(current);
    if (next === current) return false;
    const prepared = await prepareValidatedEncounterChangeForRuntime({ currentEncounter: current, nextEncounter: next, action: createEncounterActionRecord(type, payload) });
    const valid = () => isPersistenceWritable() && isCurrent() && store.getState().encounter.present === current;
    if (!valid()) return false;
    const apply = () => {
      if (!valid()) return;
      store.dispatch(commitEncounterChange({ action: prepared.action, nextEncounter: prepared.nextEncounter }));
      onCommit?.();
    };
    if (prepared.requiresConfirmation && !prepared.validationResult.blocked) {
      requestApproval({ onApprove: apply });
      return false;
    }
    if (logEncounterValidationBlock(store.dispatch, prepared)) return false;
    apply();
    return true;
  };
}
