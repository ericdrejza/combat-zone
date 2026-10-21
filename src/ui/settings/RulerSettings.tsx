import { useCanvasPreferences } from '@ui/canvas_preferences/useCanvasPreferences';
import { ColorOpacityFields } from '@ui/controls/ColorOpacityFields';
import { PreferenceSwitch } from './PreferenceSwitch';
import { SettingsField, SettingsSection, SETTINGS_CONTROL } from './SettingsLayout';

export function RulerSettings() {
  const { preferences, save } = useCanvasPreferences();
  return <SettingsSection title="Ruler">
    <SettingsField label="Ruler feel">
      <select aria-label="Ruler feel" className={SETTINGS_CONTROL} value={preferences.rulerFeel}
        onChange={event => save({ ...preferences, rulerFeel: event.currentTarget.value as typeof preferences.rulerFeel })}>
        <option value="rigid">Rigid and Snappy</option><option value="flexible">Flowy and Flexible</option>
      </select>
    </SettingsField>
    <SettingsField label="Measurement cell coverage" description="Controls highlighted cells when actor/ruler snapping is enabled. Corner rules require 3 corners on square/isometric grids and 4 on hex grids. Extra origin cells apply to cones and exclude the source cell.">
      <select aria-label="Measurement cell coverage" className={SETTINGS_CONTROL} value={preferences.rulerCellCoverage}
        onChange={event => save({ ...preferences, rulerCellCoverage: event.currentTarget.value as typeof preferences.rulerCellCoverage })}>
        <option value="corners-or-center">Corners or cell center</option>
        <option value="center">Cell center only</option>
        <option value="majority">More than half the cell area</option>
        <option value="corners-and-origin">Corners + first forward cone cell</option>
        <option value="corners-and-adjacent">Corners + all forward cells touching cone origin</option>
      </select>
    </SettingsField>
    <PreferenceSwitch label="Show calculated ruler area" checked={preferences.showRulerArea} onChange={showRulerArea => save({ ...preferences, showRulerArea })} />
    <ColorOpacityFields keepPickerOpen allowColorReset label="Ruler" value={{ color: preferences.rulerColor, opacity: preferences.rulerOpacity }}
      onChange={value => save({ ...preferences, rulerColor: value.color, rulerOpacity: value.opacity })} />
  </SettingsSection>;
}
