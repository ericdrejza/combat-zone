import { readBackgroundResizeOverflowPreference } from '@ui/interface_preferences/InterfacePreferenceProvider';
import { Eye, EyeOff, Waypoints, Settings2 } from 'lucide-react';
import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '@store/store';
import { startGridCalibration, cancelGridEditing } from '@interaction/interactionState';
import { updateGridConfiguration } from '@core/movement/updateGridConfiguration';
import type { GridConfiguration } from '@core/movement/types';
import { useKeyboardEncounterCommit } from '@ui/canvas/useKeyboardEncounterCommit';
import { usePersistence } from '@ui/persistence/PersistenceProvider';
import { ToolbarOptionButton, ToolbarOptionGroup } from '../ToolbarOption';
import { GridSettingsDialog } from './GridSettingsDialog';

/** Shared configuration surface is available in Background regardless of movement. */
export function GridControls({ showSettings = true }: { showSettings?: boolean }) {
  const encounter = useSelector((state: RootState) => state.encounter.present);
  const aligning = useSelector((state: RootState) => state.interaction.gridCalibrationActive);
  const dispatch = useDispatch();
  const { readOnly } = usePersistence();
  const commit = useKeyboardEncounterCommit();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  async function update(grid: GridConfiguration) {
    setBusy(true);
    try { return await commit('grid.update', {}, state => updateGridConfiguration(state, grid, readBackgroundResizeOverflowPreference())); }
    finally { setBusy(false); }
  }
  return <>
    <ToolbarOptionGroup aria-label="Grid controls" role="group">
      <ToolbarOptionButton aria-label={encounter.grid.visible ? 'Hide grid' : 'Show grid'} title={encounter.grid.visible ? 'Hide grid' : 'Show grid'} active={encounter.grid.visible} disabled={readOnly || busy}
        onClick={() => void update({ ...encounter.grid, visible: !encounter.grid.visible })} type="button">
        {encounter.grid.visible ? <Eye size={16} /> : <EyeOff size={16} />}
      </ToolbarOptionButton>
      {showSettings ? <ToolbarOptionButton aria-label="Grid settings" title="Grid settings" active={settingsOpen} aria-pressed={settingsOpen} aria-expanded={settingsOpen} disabled={readOnly || busy} onClick={() => setSettingsOpen(open => !open)} type="button"><Settings2 size={16} /></ToolbarOptionButton> : null}
      <ToolbarOptionButton aria-label="Align grid to background" title="Align grid to background" active={aligning} aria-pressed={aligning} aria-expanded={aligning} disabled={readOnly || busy} onClick={() => dispatch(aligning ? cancelGridEditing() : startGridCalibration(encounter.grid.type))} type="button"><Waypoints size={16} /></ToolbarOptionButton>
    </ToolbarOptionGroup>
    {settingsOpen ? <GridSettingsDialog encounter={encounter} busy={busy} onApply={update} onClose={() => setSettingsOpen(false)} /> : null}
  </>;
}
