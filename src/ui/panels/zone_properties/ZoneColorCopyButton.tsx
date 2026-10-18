import { useEffect, useId } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '@store/store';
import { usePersistence } from '@ui/persistence/PersistenceProvider';
import { useColorSampler } from '@ui/canvas/color_sampler/ColorSamplerProvider';
import { SamplerButton } from '@ui/canvas/color_sampler/SamplerButton';
import { getPaintableZoneProperties } from '@ui/canvas/zones/zonePropertyTransfers';
import { updateZoneProperties } from '@entities/zone/zoneMutations';
import type { Zone } from '@entities/zone/types';
import { prepareValidatedEncounterChangeForRuntime } from '@core/validation/runtimeEncounterChange';
import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import { consumeEncounterChange } from '@store/consumeEncounterChange';
import { commitEncounterChange } from '@store/encounterSlice';
import { logEncounterValidationBlock } from '@store/encounterLogSlice';
import { isPersistenceWritable } from '@store/persistenceWriteGuardMiddleware';

/** Inverse painting applies one source's appearance to all selected targets. */
export function ZoneColorCopyButton() {
  const sampler = useColorSampler(), key = useId(), dispatch = useDispatch();
  const { readOnly } = usePersistence();
  const encounter = useSelector((state: RootState) => state.encounter.present);
  const selection = useSelector((state: RootState) => state.interaction.selection);
  useEffect(() => () => sampler.cancel(key), [key, sampler.cancel]);
  useEffect(() => { if (readOnly) sampler.cancel(key); }, [readOnly, key, sampler.cancel]);
  return <SamplerButton label="Copy colors from zone" active={sampler.session?.key === key} disabled={readOnly}
    onClick={() => sampler.toggle({ key, kind: 'zone', pick: sourceZoneId => {
      const source = encounter.zones.byId[sourceZoneId];
      if (!source || selection.selectedEntityType !== 'zone' || !isPersistenceWritable()) return;
      const properties = getPaintableZoneProperties(source);
      const targetZoneIds = selection.selectedIds.filter(id => {
        const target = encounter.zones.byId[id];
        return target && id !== sourceZoneId && Object.entries(properties).some(([field, value]) => target[field as keyof Zone] !== value);
      });
      const nextEncounter = targetZoneIds.reduce((state, id) => updateZoneProperties(state, id, properties), encounter);
      if (nextEncounter === encounter) return;
      const prepared = prepareValidatedEncounterChangeForRuntime({ currentEncounter: encounter, nextEncounter,
        action: createEncounterActionRecord('zone.paintColors', { sourceZoneId, targetZoneIds, properties }) });
      void consumeEncounterChange(prepared, encounter, dispatch, resolved => {
        if (logEncounterValidationBlock(dispatch, resolved)) return;
        dispatch(commitEncounterChange({ action: resolved.action, nextEncounter: resolved.nextEncounter }));
      });
    } })} />;
}
