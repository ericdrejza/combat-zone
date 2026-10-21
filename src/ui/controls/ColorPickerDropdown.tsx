import { useInterfacePreferences } from "@ui/interface_preferences/InterfacePreferenceProvider";
import { COLOR_PICKER_PRESETS } from "./colorPickerPresets";
import { ColorSpectrum } from "./ColorSpectrum";
import { ColorRangeInput } from "./ColorRangeInput";
import { useRef, type ReactNode } from "react";
import { ColorPalettePicker } from './ColorPalettePicker';
import { SETTINGS_SLIDER } from '@ui/settings/SettingsLayout';

/** A controlled palette can be collapsed without leaving a browser-native popup over the dialog. */
export function ColorPickerDropdown({ label, value, onChange, closeOnSelect = true, spectrum = false, showLabel = true, disabled = false, labelAction, onCommit, onCancel, controls }: { controls?: ReactNode; onCancel?: () => void; disabled?: boolean; labelAction?: ReactNode; onCommit?: (color: string) => void; spectrum?: boolean; showLabel?: boolean; closeOnSelect?: boolean; label: string; value: string; onChange: (color: string) => void }) {
  const { recentCustomColors, rememberCustomColor } = useInterfacePreferences();
  const latestColor = useRef(value);
  latestColor.current = value;
  const channels = [1, 3, 5].map(start => parseInt(value.slice(start, start + 2), 16));
  return <ColorPalettePicker closeOnSelect={closeOnSelect} label={label} value={value} disabled={disabled} labelAction={labelAction} onChange={color => { onChange(color); onCommit?.(color); }}
    presets={spectrum ? COLOR_PICKER_PRESETS : undefined}
    recentColors={spectrum ? recentCustomColors : undefined}
    onRecentColor={color => { onChange(color); rememberCustomColor(color); onCommit?.(color); }}
    showLabel={showLabel} controls={controls}
    beforeSwatches={spectrum ? <ColorSpectrum onCancel={onCancel} label={label} value={value} onChange={onChange} onCommit={color => { rememberCustomColor(color); onCommit?.(color); }} /> : undefined}>
    {!spectrum && ['Red', 'Green', 'Blue'].map((channel, index) => <label key={channel} className="block space-y-1 text-sm">
      <span className="flex justify-between"><span>{channel}</span><span>{channels[index]}</span></span>
      <ColorRangeInput aria-label={`${label} ${channel.toLowerCase()}`} className={SETTINGS_SLIDER} min={0} max={255} step={1} value={channels[index]}
        onValueChange={value => {
          const next = [1, 3, 5].map(start => parseInt(latestColor.current.slice(start, start + 2), 16));
          next[index] = value;
          const color = `#${next.map(n => n.toString(16).padStart(2, '0')).join('')}`;
          latestColor.current = color;
          onChange(color);
        }} />
    </label>)}
  </ColorPalettePicker>;
}
