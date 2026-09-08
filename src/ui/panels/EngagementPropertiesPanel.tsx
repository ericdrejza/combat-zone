import { useDispatch, useSelector } from 'react-redux';

import type { LayoutOrientation } from '@core/layout/types';
import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import { prepareValidatedEncounterChangeForRuntime } from '@core/validation/validatedEncounterChange';
import { updateEngagementProperties } from '@entities/engagement/engagementMutations';
import type { Engagement } from '@entities/engagement/types';
import { commitEncounterChange } from '@store/encounterSlice';
import { logEncounterValidationBlock } from '@store/encounterLogSlice';
import type { RootState } from '@store/store';

const STRATEGIES: Engagement['layoutStrategy'][] = ['FLEX', 'SEQUENTIAL'];
const ORIENTATIONS: LayoutOrientation[] = ['LEFT_RIGHT', 'TOP_BOTTOM'];

export function EngagementPropertiesPanel() {
  const dispatch = useDispatch();
  const encounter = useSelector((state: RootState) => state.encounter.present);
  const selection = useSelector((state: RootState) => state.interaction.selection);
  const engagementId = selection.selectedEntityType === 'engagement' ? selection.selectedIds[0] : undefined;
  const engagement = engagementId ? encounter.engagements.byId[engagementId] : undefined;
  if (!engagement) return <p className="text-sm text-canvas-muted">Select an engagement to edit its layout.</p>;

  function update(properties: Parameters<typeof updateEngagementProperties>[2]) {
    if (!engagement) return;
    const nextEncounter = updateEngagementProperties(encounter, engagement.id, properties);
    if (nextEncounter === encounter) return;
    const prepared = prepareValidatedEncounterChangeForRuntime({
      action: createEncounterActionRecord('engagement.update', { engagementId: engagement.id, participantIds: engagement.participantIds, parentZoneId: engagement.parentZoneId, properties }),
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
    <div className="space-y-4 text-sm">
      <p className="text-canvas-muted">{engagement.participantIds.length} participants</p>
      <label className="block space-y-1">
        <span className="font-semibold text-canvas-ink">Layout</span>
        <select className="w-full rounded-xl border border-canvas-line bg-canvas-surface px-3 py-2 text-canvas-ink" onChange={(event) => update({ layoutStrategy: event.currentTarget.value as Engagement['layoutStrategy'] })} value={engagement.layoutStrategy}>
          {STRATEGIES.map((strategy) => <option key={strategy} value={strategy}>{strategy}</option>)}
        </select>
      </label>
      <label className="block space-y-1">
        <span className="font-semibold text-canvas-ink">Orientation</span>
        <select className="w-full rounded-xl border border-canvas-line bg-canvas-surface px-3 py-2 text-canvas-ink" onChange={(event) => update({ layoutOrientation: event.currentTarget.value as LayoutOrientation })} value={engagement.layoutOrientation}>
          {ORIENTATIONS.map((orientation) => <option key={orientation} value={orientation}>{orientation === 'LEFT_RIGHT' ? 'Left to right' : 'Top to bottom'}</option>)}
        </select>
      </label>
    </div>
  );
}
