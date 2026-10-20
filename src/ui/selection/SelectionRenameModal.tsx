import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '@store/store';
import { RenameModal } from '@ui/RenameModal';
import { ActorRenameModal } from '@ui/toolbar/actor/ActorRenameModal';
import { updateZoneProperties } from '@entities/zone/zoneMutations';
import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import { commitEncounterChange } from '@store/encounterSlice';

/** Preserve the existing actor rename flow and use the same history boundary for selected zones. */
export function SelectionRenameModal({ onClose }: { onClose: () => void }) {
  const dispatch = useDispatch(), encounter = useSelector((state: RootState) => state.encounter.present);
  const selection = useSelector((state: RootState) => state.interaction.selection);
  if (selection.selectedEntityType === 'actor') return <ActorRenameModal onClose={onClose} />;
  const zoneIds = selection.selectedEntityType === 'zone' ? selection.selectedIds : [];
  if (!zoneIds.length) return null;
  return <RenameModal ariaLabel="Rename zones" title="Rename zones" inputLabel="New zone name" initialName={zoneIds.length === 1 ? encounter.zones.byId[zoneIds[0]]?.name : ''} onClose={onClose}
    onRename={name => {
      const nextEncounter = zoneIds.reduce((state, id) => updateZoneProperties(state, id, { name }), encounter);
      if (nextEncounter !== encounter) dispatch(commitEncounterChange({ action: createEncounterActionRecord('zone.updateProperties', { zoneId: zoneIds[0], zoneIds, properties: { name } }), nextEncounter }));
    }} />;
}
