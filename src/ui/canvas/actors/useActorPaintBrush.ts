import { useEffect, useRef } from 'react';

import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import { prepareValidatedEncounterChangeForRuntime } from '@core/validation/validatedEncounterChange';
import { updateActorProperties } from '@entities/actor/actorMutations';
import { commitEncounterChange } from '@store/encounterSlice';
import type { AppDispatch, RootState } from '@store/store';
import { useZoneResizeApproval } from '../../zoneResizeApproval';

type UseActorPaintBrushInput = {
  actorPaintBrush: boolean;
  actorTool: RootState['interaction']['actorTool'];
  dispatch: AppDispatch;
  encounter: RootState['encounter']['present'];
  selection: RootState['interaction']['selection'];
};

export function useActorPaintBrush({
  actorPaintBrush,
  actorTool,
  dispatch,
  encounter,
  selection
}: UseActorPaintBrushInput) {
  const lastPaintTriggerRef = useRef<string | null>(null);
  const { requestApproval } = useZoneResizeApproval();

  useEffect(() => {
    const paintTrigger = JSON.stringify([
      actorPaintBrush,
      actorTool.layoutGroup,
      actorTool.shape,
      actorTool.size,
      selection.selectedEntityType,
      selection.selectedIds
    ]);

    if (lastPaintTriggerRef.current === paintTrigger) {
      return;
    }

    lastPaintTriggerRef.current = paintTrigger;

    if (
      !actorPaintBrush ||
      selection.selectedEntityType !== 'actor' ||
      selection.selectedIds.length === 0
    ) {
      return;
    }

    const properties = {
      layoutGroup: actorTool.layoutGroup,
      shape: actorTool.shape,
      size: actorTool.size
    };
    const actorIdsToPaint = selection.selectedIds.filter((actorId) => {
      const actor = encounter.actors.byId[actorId];

      return (
        actor &&
        (actor.layoutGroup !== properties.layoutGroup ||
          actor.shape !== properties.shape ||
          actor.size !== properties.size)
      );
    });

    if (actorIdsToPaint.length === 0) {
      return;
    }

    const nextEncounter = actorIdsToPaint.reduce(
      (currentEncounter, actorId) =>
        updateActorProperties(currentEncounter, actorId, properties),
      encounter
    );

    const prepared = prepareValidatedEncounterChangeForRuntime({
      action: createEncounterActionRecord('actor.paint', {
        actorIds: actorIdsToPaint,
        properties
      }),
      currentEncounter: encounter,
      nextEncounter
    });
    const handlePrepared = (resolved: Awaited<typeof prepared>) => {
      const commitPreparedChange = () => {
        dispatch(
          commitEncounterChange({
            action: resolved.action,
            nextEncounter: resolved.nextEncounter
          })
        );
      };

      if (resolved.requiresConfirmation) {
        requestApproval({ onApprove: commitPreparedChange });
        return;
      }

      if (!resolved.blocked) {
        commitPreparedChange();
      }
    };

    if (prepared instanceof Promise) {
      void prepared.then(handlePrepared);
    } else {
      handlePrepared(prepared);
    }
  }, [
    actorPaintBrush,
    actorTool.layoutGroup,
    actorTool.shape,
    actorTool.size,
    dispatch,
    encounter,
    requestApproval,
    selection.selectedEntityType,
    selection.selectedIds
  ]);
}
