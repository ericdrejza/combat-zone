import { useDispatch, useSelector } from "react-redux";

import type { EncounterState } from "@core/encounter/types";
import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import type { JsonObject } from "@core/history/types";
import { prepareValidatedEncounterChangeForRuntime } from "@core/validation/validatedEncounterChange";
import { commitEncounterChange } from "@store/encounterSlice";
import { logEncounterValidationBlock } from "@store/encounterLogSlice";
import type { RootState } from "@store/store";

/** Commits initiative mutations through validation and snapshot history. */
export function useInitiativeActions() {
  const dispatch = useDispatch();
  const encounter = useSelector((state: RootState) => state.encounter.present);

  function commitInitiativeChange(
    actionType: string,
    payload: JsonObject,
    nextEncounter: EncounterState
  ) {
    if (nextEncounter === encounter) return;

    const prepared = prepareValidatedEncounterChangeForRuntime({
      action: createEncounterActionRecord(actionType, payload),
      currentEncounter: encounter,
      nextEncounter
    });
    const handlePrepared = (resolved: Awaited<typeof prepared>) => {
      if (logEncounterValidationBlock(dispatch, resolved)) return;
      if (!resolved.blocked) {
        dispatch(
          commitEncounterChange({
            action: resolved.action,
            nextEncounter: resolved.nextEncounter
          })
        );
      }
    };

    if (prepared instanceof Promise) void prepared.then(handlePrepared);
    else handlePrepared(prepared);
  }

  return { commitInitiativeChange, encounter };
}
