import { useStore } from "react-redux";
import type { EncounterState } from "@core/encounter/types";
import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import type { JsonObject } from "@core/history/types";
import { prepareValidatedEncounterChangeForRuntime } from "@core/validation/validatedEncounterChange";
import { commitEncounterChange } from "@store/encounterSlice";
import { logEncounterValidationBlock } from "@store/encounterLogSlice";
import { isPersistenceWritable } from "@store/persistenceWriteGuardMiddleware";
import type { RootState } from "@store/store";

/** Rebase queued status commands after asynchronous validation rather than overwrite newer state. */
export function useStatusActions() {
  const store = useStore<RootState>();
  async function commit(type: string, payload: JsonObject, mutate: (state: EncounterState) => EncounterState, isCurrent: () => boolean = () => true): Promise<void> {
    if (!isPersistenceWritable() || !isCurrent()) return;
    const currentEncounter = store.getState().encounter.present;
    const nextEncounter = mutate(currentEncounter);
    if (nextEncounter === currentEncounter) return;
    const prepared = await prepareValidatedEncounterChangeForRuntime({
      currentEncounter, nextEncounter, action: createEncounterActionRecord(type, payload)
    });
    if (!isPersistenceWritable() || !isCurrent()) return;
    const latest = store.getState().encounter.present;
    if (latest.id !== currentEncounter.id) return;
    if (latest !== currentEncounter) return commit(type, payload, mutate, isCurrent);
    if (logEncounterValidationBlock(store.dispatch, prepared)) return;
    if (!prepared.blocked) store.dispatch(commitEncounterChange({ action: prepared.action, nextEncounter: prepared.nextEncounter }));
  }
  return commit;
}
