import { useCanvasPreferences } from '@ui/canvas_preferences/useCanvasPreferences';
import { DEFAULT_FOCUS_PREFERENCES, MAX_FOCUS_TAIL_LENGTH, type FocusPreferences } from '@ui/canvas/focus/focusPreferences';
import { ColorPicker } from '@ui/controls/ColorPicker';
import { SettingsField, SettingsRow, SettingsSection, SETTINGS_CONTROL, SETTINGS_SLIDER } from './SettingsLayout';

export function FocusSettings() {
  const { preferences, save } = useCanvasPreferences();
  const { focus } = preferences;
  const tailPercentage = Math.round(focus.tailLength / MAX_FOCUS_TAIL_LENGTH * 100);
  const update = (change: Partial<FocusPreferences>) => save({ ...preferences, focus: { ...focus, ...change } });
  return <SettingsSection title="Focus" description="A shared laser pointer for the GM canvas and player view. Focus temporarily prevents canvas editing.">
    <SettingsField label="Focus activation">
      <select className={SETTINGS_CONTROL} value={focus.activation} onChange={event => update({ activation: event.currentTarget.value as FocusPreferences['activation'] })}>
        <option value="hold">Hold shortcut</option><option value="toggle">Press to toggle</option>
      </select>
    </SettingsField>
    <SettingsRow label="Focus color">
      <ColorPicker label="Focus" value={focus.color} fallbackColor={DEFAULT_FOCUS_PREFERENCES.color} resetValue={DEFAULT_FOCUS_PREFERENCES.color}
        onChange={color => update({ color: color ?? DEFAULT_FOCUS_PREFERENCES.color })} />
    </SettingsRow>
    <SettingsField label="Focus tail length" description="How far the flowing trail follows behind the pointer. Set to zero for no trail." valueLabel={`${tailPercentage}%`}>
      <input type="range" className={SETTINGS_SLIDER} min={0} max={100} step={1} value={tailPercentage}
        onChange={event => update({ tailLength: event.currentTarget.valueAsNumber / 100 * MAX_FOCUS_TAIL_LENGTH })} />
    </SettingsField>
    <SettingsField label="Focus glow intensity" valueLabel={`${Math.round(focus.glowIntensity * 100)}%`}>
      <input type="range" className={SETTINGS_SLIDER} min={0} max={100} step={1} value={Math.round(focus.glowIntensity * 100)}
        onChange={event => update({ glowIntensity: event.currentTarget.valueAsNumber / 100 })} />
    </SettingsField>
  </SettingsSection>;
}
