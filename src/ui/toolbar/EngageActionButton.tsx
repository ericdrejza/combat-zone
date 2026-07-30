import { useDispatch, useSelector } from 'react-redux';

import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import { prepareValidatedEncounterChangeForRuntime } from '@core/validation/validatedEncounterChange';
import { engageSelectedActors } from '@entities/engagement/engagementMutations';
import { commitEncounterChange } from '@store/encounterSlice';
import type { RootState } from '@store/store';
import crossedSwordsAsset from '@assets/images/crossed-swords.svg';

const CROSSED_SWORDS_ASSET = crossedSwordsAsset;

/** One-shot action: group the current actor selection independently per zone. */
export function EngageActionButton() {
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
      if (!resolved.blocked) dispatch(commitEncounterChange({ action: resolved.action, nextEncounter: resolved.nextEncounter }));
    };
    if (prepared instanceof Promise) void prepared.then(commit); else commit(prepared);
  }

  return (
    <button
      aria-label="Engage selected actors"
      aria-pressed={previewActive}
      className={`shrink-0 rounded-full border p-2 shadow-sm transition ${
        previewActive
          ? 'border-canvas-ink bg-canvas-ink text-white'
          : 'border-canvas-line bg-white text-canvas-ink hover:bg-canvas disabled:opacity-40'
      } disabled:cursor-not-allowed`}
      disabled={actorIds.length < 2}
      onClick={engage}
      title="Engage selected actors in each zone"
      type="button"
    >
      <img
        alt=""
        aria-hidden="true"
        className={`h-4 w-4 ${previewActive ? 'brightness-0 invert' : ''}`}
        src={CROSSED_SWORDS_ASSET}
      />
    </button>
  );
}
