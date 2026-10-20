import { readBackgroundResizeOverflowPreference } from '@ui/interface_preferences/InterfacePreferenceProvider';
import { Eye, EyeOff, Settings2, Magnet, Blend, Scissors, VectorSquare, LayoutGrid } from 'lucide-react';
import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '@store/store';
import { startGridCalibration, cancelGridEditing } from '@interaction/interactionState';
import { updateGridConfiguration } from '@core/movement/updateGridConfiguration';
import type { GridConfiguration } from '@core/movement/types';
import { useKeyboardEncounterCommit } from '@ui/canvas/useKeyboardEncounterCommit';
import { ToolbarOptionButton, ToolbarOptionGroup } from '../ToolbarOption';
import { GridSettingsDialog } from './GridSettingsDialog';
import { useMovementRuleControls } from './useMovementRuleControls';

export function GridControls() {
  const { encounter, toggle, disabled, error } = useMovementRuleControls();
  const aligning = useSelector((state: RootState) => state.interaction.gridCalibrationActive);
  const dispatch = useDispatch(), commit = useKeyboardEncounterCommit();
  const [settingsOpen, setSettingsOpen] = useState(false), [busy, setBusy] = useState(false);
  async function update(grid: GridConfiguration) {
    setBusy(true);
    try { return await commit('grid.update', {}, state => updateGridConfiguration(state, grid, readBackgroundResizeOverflowPreference())); }
    finally { setBusy(false); }
  }
  const rules = encounter.movementRules;
  return <>
    <ToolbarOptionGroup aria-label="Grid visibility and snapping" role="group">
      <ToolbarOptionButton aria-label={encounter.grid.visible ? 'Hide grid' : 'Show grid'} active={encounter.grid.visible} aria-pressed={encounter.grid.visible} disabled={disabled || busy}
        onClick={() => void update({ ...encounter.grid, visible: !encounter.grid.visible })} type="button">
        {encounter.grid.visible ? <Eye size={16} /> : <EyeOff size={16} />}
      </ToolbarOptionButton>
      <ToolbarOptionButton aria-label="Snap Actors and Rulers to Grid" title="Snap Actors and Rulers to Grid" active={rules.snapToGrid} aria-pressed={rules.snapToGrid} disabled={disabled || busy} onClick={() => void toggle('snapToGrid')} type="button"><Magnet size={16} /></ToolbarOptionButton>
      <ToolbarOptionButton aria-label="Snap Zone Vertices to Grid" active={rules.snapZoneVertices} aria-pressed={rules.snapZoneVertices} disabled={disabled || busy} onClick={() => void toggle('snapZoneVertices')} type="button"><VectorSquare size={16} /></ToolbarOptionButton>
    </ToolbarOptionGroup>
    <ToolbarOptionGroup aria-label="Grid token rules" role="group">
      <ToolbarOptionButton aria-label="Overlap" active={rules.allowOverlap} aria-pressed={rules.allowOverlap} disabled={disabled || busy || rules.zoneLocked} onClick={() => void toggle('allowOverlap')} type="button"><Blend size={16} /></ToolbarOptionButton>
      <ToolbarOptionButton aria-label="Trim" active={rules.trimTokens} aria-pressed={rules.trimTokens} disabled={disabled || busy || !rules.snapToGrid} onClick={() => void toggle('trimTokens')} type="button"><Scissors size={16} /></ToolbarOptionButton>
    </ToolbarOptionGroup>
    <ToolbarOptionGroup aria-label="Grid alignment and settings" role="group">
      <ToolbarOptionButton aria-label="Align grid to background" active={aligning} aria-pressed={aligning} aria-expanded={aligning} disabled={disabled || busy} onClick={() => dispatch(aligning ? cancelGridEditing() : startGridCalibration(encounter.grid.type))} type="button"><LayoutGrid size={16} /></ToolbarOptionButton>
      <ToolbarOptionButton aria-label="Grid settings" active={settingsOpen} aria-pressed={settingsOpen} aria-expanded={settingsOpen} disabled={disabled || busy} onClick={() => setSettingsOpen(open => !open)} type="button"><Settings2 size={16} /></ToolbarOptionButton>
    </ToolbarOptionGroup>
    {settingsOpen ? <GridSettingsDialog encounter={encounter} busy={busy} onApply={update} onClose={() => setSettingsOpen(false)} /> : null}
    {error ? <span role="alert" className="max-w-52 text-xs text-red-600">{error}</span> : null}
  </>;
}
