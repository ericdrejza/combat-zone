import type { DiagonalCost } from '@core/measurement/types';
import { useMovementPreferences } from '@ui/combat_preferences/useMovementPreferences';
import { usePersistence } from '@ui/persistence/PersistenceProvider';
import { PreferenceSwitch } from './PreferenceSwitch';
import { SettingsField, SETTINGS_CONTROL } from './SettingsLayout';

export function MovementMeasurementSettings() {
  const { preferences, save } = useMovementPreferences();
  const { readOnly } = usePersistence();
  return <fieldset disabled={readOnly} className="space-y-3 disabled:opacity-50">
    <SettingsField label="Square grid diagonals"><select aria-label="Square grid diagonals" className={SETTINGS_CONTROL} value={preferences.diagonalCost}
      onChange={event => void save({ ...preferences, diagonalCost: event.currentTarget.value as DiagonalCost })}>
      <option value="one">1 cell</option><option value="alternating">Alternating 1–2 cells</option><option value="two">2 cells</option><option value="disabled">Orthogonal only</option>
    </select></SettingsField>
    <PreferenceSwitch label="Track movement during initiative" checked={preferences.trackMovement} onChange={trackMovement => void save({ ...preferences, trackMovement })} />
    <SettingsField label="Reset movement totals"><select disabled={!preferences.trackMovement} aria-label="Reset movement totals" className={SETTINGS_CONTROL} value={preferences.resetMovement}
      onChange={event => void save({ ...preferences, resetMovement: event.currentTarget.value as 'turn' | 'round' })}>
      <option value="turn">Each turn</option><option value="round">Each round</option>
    </select></SettingsField>
  </fieldset>;
}
