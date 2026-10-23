import { useNamePreview } from '@ui/controls/useNamePreview';
import { selectRulerPropertiesArtifact } from '@interaction/rulerState';
import { updateLockedRuler } from '@interaction/rulerCommands';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '@store/store';
import { RenameModal } from '@ui/RenameModal';
import { ActorRenameModal } from '@ui/toolbar/actor/ActorRenameModal';
import { updateZoneProperties } from '@entities/zone/zoneMutations';
import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import { commitEncounterChange } from '@store/encounterSlice';

/** Match Properties targeting and preserve the history or active-draft boundary for each entity. */
export function SelectionRenameModal({ onClose }: { onClose: () => void }) {
  const dispatch = useDispatch(), encounter = useSelector((state: RootState) => state.encounter.present);
  const selection = useSelector((state: RootState) => state.interaction.selection);
  const ruler = useSelector(selectRulerPropertiesArtifact);
  const previewName = useNamePreview(ruler ? 'ruler' : 'zone', ruler ? [ruler.id] : selection.selectedEntityType === 'zone' ? selection.selectedIds : []);
  if (ruler) return <RenameModal ariaLabel="Name ruler" title="Name ruler" inputLabel="Ruler name" initialName={ruler.name} onPreview={previewName} onClose={onClose}
    onRename={name => dispatch(updateLockedRuler({ id: ruler.id, name }))} />;
  if (selection.selectedEntityType === 'actor') return <ActorRenameModal onClose={onClose} />;
  const zoneIds = selection.selectedEntityType === 'zone' ? selection.selectedIds : [];
  if (!zoneIds.length) return null;
  return <RenameModal onPreview={previewName} ariaLabel="Rename zones" title="Rename zones" inputLabel="New zone name" initialName={zoneIds.length === 1 ? encounter.zones.byId[zoneIds[0]]?.name : ''} onClose={onClose}
    onRename={name => {
      const nextEncounter = zoneIds.reduce((state, id) => updateZoneProperties(state, id, { name }), encounter);
      if (nextEncounter !== encounter) dispatch(commitEncounterChange({ action: createEncounterActionRecord('zone.updateProperties', { zoneId: zoneIds[0], zoneIds, properties: { name } }), nextEncounter }));
    }} />;
}
