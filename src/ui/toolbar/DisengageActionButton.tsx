import { Unlink2 } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';

import { getActorEngagement } from '@core/encounter/inspectors';
import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import { prepareValidatedEncounterChangeForRuntime } from '@core/validation/validatedEncounterChange';
import { leaveEngagements } from '@entities/engagement/engagementMutations';
import { commitEncounterChange } from '@store/encounterSlice';
import { logEncounterValidationBlock } from '@store/encounterLogSlice';
import type { RootState } from '@store/store';

/** Removes only selected actors from their current Engagement groups. */
type DisengageActionButtonProps = {
  compact?: boolean;
};

export function DisengageActionButton({ compact = false }: DisengageActionButtonProps) {
  const dispatch = useDispatch();
  const encounter = useSelector((state: RootState) => state.encounter.present);
  const selection = useSelector(
    (state: RootState) => state.interaction.selection
  );
  const previewActive = useSelector(
    (state: RootState) => state.interaction.dragActionPreview === 'disengage'
  );
  const selectedActorIds =
    selection.selectedEntityType === 'actor' ? selection.selectedIds : [];
  const engagedActorIds = selectedActorIds.filter((actorId) =>
    Boolean(getActorEngagement(encounter, actorId))
  );

  function disengage() {
    if (engagedActorIds.length === 0) return;
    const nextEncounter = leaveEngagements(encounter, engagedActorIds);
    if (nextEncounter === encounter) return;
    const prepared = prepareValidatedEncounterChangeForRuntime({
      action: createEncounterActionRecord('engagement.leaveSelected', {
        actorIds: engagedActorIds
      }),
      currentEncounter: encounter,
      nextEncounter
    });
    const commit = (resolved: Awaited<typeof prepared>) => {
      logEncounterValidationBlock(dispatch, resolved);
      if (!resolved.blocked) {
        dispatch(
          commitEncounterChange({
            action: resolved.action,
            nextEncounter: resolved.nextEncounter
          })
        );
      }
    };
    if (prepared instanceof Promise) void prepared.then(commit);
    else commit(prepared);
  }

  return (
    <button
      aria-label="Disengage selected actors"
      aria-pressed={previewActive}
      className={`${compact ? 'flex h-11 min-w-11 items-center justify-center' : ''} shrink-0 rounded-full border p-2 shadow-sm transition ${
        previewActive
          ? 'border-canvas-ink bg-canvas-ink text-white'
          : 'border-canvas-line bg-white text-canvas-ink hover:bg-canvas disabled:opacity-40'
      } disabled:cursor-not-allowed`}
      disabled={engagedActorIds.length === 0}
      onClick={disengage}
      title="Disengage selected actors"
      type="button"
    >
      <Unlink2 aria-hidden="true" className="h-4 w-4" />
    </button>
  );
}
