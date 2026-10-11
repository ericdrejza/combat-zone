import { useDispatch, useSelector } from "react-redux";
import { prepareValidatedEncounterChangeForRuntime } from "@core/validation/runtimeEncounterChange";
import { updateActorProperties } from "@entities/actor/actorMutations";
import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { commitEncounterChange } from "@store/encounterSlice";
import { logEncounterValidationBlock } from "@store/encounterLogSlice";
import type { RootState } from "@store/store";
import { useZoneResizeApproval } from "@ui/zoneResizeApproval";

/** Body and header mutations share validation, resize approval, and history. */
export function useActorPropertiesActions() {
  const dispatch = useDispatch();
  const { requestApproval } = useZoneResizeApproval();
  const encounter = useSelector((state: RootState) => state.encounter.present);
  const selection = useSelector((state: RootState) => state.interaction.selection);
  const selectedActorId = selection.selectedEntityType === "actor" ? selection.selectedIds[0] : undefined;
  const actor = selectedActorId ? encounter.actors.byId[selectedActorId] : undefined;
  function commitActorProperties(
    properties: Parameters<typeof updateActorProperties>[2]
  ) {
    if (!actor) {
      return;
    }

    const nextEncounter = updateActorProperties(
      encounter,
      actor.id,
      properties
    );

    if (nextEncounter === encounter) {
      return;
    }

    const prepared = prepareValidatedEncounterChangeForRuntime({
      action: createEncounterActionRecord("actor.updateProperties", {
        actorId: actor.id,
        properties
      }),
      currentEncounter: encounter,
      nextEncounter
    });

    const commitPreparedChange = (resolved: Awaited<typeof prepared>) => {
      dispatch(
        commitEncounterChange({
          action: resolved.action,
          nextEncounter: resolved.nextEncounter
        })
      );
    };

    const handlePrepared = (resolved: Awaited<typeof prepared>) => {
      if (logEncounterValidationBlock(dispatch, resolved)) {
        return;
      }
      if (resolved.requiresConfirmation) {
        requestApproval({ onApprove: () => commitPreparedChange(resolved) });
        return;
      }

      if (!resolved.blocked) {
        commitPreparedChange(resolved);
      }
    };

    if (prepared instanceof Promise) {
      void prepared.then(handlePrepared);
    } else {
      handlePrepared(prepared);
    }
  }

  return { actor, commitActorProperties };
}
