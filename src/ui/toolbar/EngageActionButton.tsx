import { Swords } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';

import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import { prepareValidatedEncounterChangeForRuntime } from '@core/validation/validatedEncounterChange';
import { engageSelectedActors } from '@entities/engagement/engagementMutations';
import { commitEncounterChange } from '@store/encounterSlice';
import { logEncounterValidationBlock } from '@store/encounterLogSlice';
import type { RootState } from '@store/store';

type EngageActionButtonProps = {
  compact?: boolean;
};

/** One-shot action: group the current actor selection independently per zone. */
export function EngageActionButton({ compact = false }: EngageActionButtonProps) {
  const dispatch = useDispatch();
  const encounter = useSelector((state: RootState) => state.encounter.present);
  const selection = useSelector((state: RootState) => state.interaction.selection);
  const previewActive = useSelector(
    (state: RootState) => state.interaction.dragActionPreview === 'engage'
  );
  const actorIds = selection.selectedEntityType === 'actor' ? selection.selectedIds : [];

  function engage() {
    if (actorIds.length < 2) return;
    let sequence = 0;
    const nextEncounter = engageSelectedActors(encounter, actorIds, (zoneId) => {
      sequence += 1;
      return `engagement-${Date.now()}-${zoneId}-${sequence}`;
    });
    if (nextEncounter === encounter) return;
    const prepared = prepareValidatedEncounterChangeForRuntime({
      action: createEncounterActionRecord('engagement.groupSelected', { actorIds }),
      currentEncounter: encounter,
      nextEncounter
    });
    const commit = (resolved: Awaited<typeof prepared>) => {
      logEncounterValidationBlock(dispatch, resolved);
      if (!resolved.blocked) dispatch(commitEncounterChange({ action: resolved.action, nextEncounter: resolved.nextEncounter }));
    };
    if (prepared instanceof Promise) void prepared.then(commit); else commit(prepared);
  }

  return (
    <button
      aria-label="Engage selected actors"
      aria-pressed={previewActive}
      className={`${compact ? 'flex h-11 min-w-11 items-center justify-center' : ''} shrink-0 rounded-full border p-2 shadow-sm transition ${
        previewActive
          ? 'border-canvas-ink bg-canvas-ink text-canvas-on-ink'
          : 'border-canvas-line bg-canvas-surface text-canvas-ink hover:bg-canvas disabled:opacity-40'
      } disabled:cursor-not-allowed`}
      disabled={actorIds.length < 2}
      onClick={engage}
      title="Engage selected actors in each zone"
      type="button"
    >
      <Swords
        aria-hidden="true"
        className="pointer-events-none h-4 w-4"
        data-crossed-swords-icon="true"
      />
    </button>
  );
}
