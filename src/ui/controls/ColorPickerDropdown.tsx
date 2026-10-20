import { ColorPalettePicker } from './ColorPalettePicker';
import { SETTINGS_SLIDER } from '@ui/settings/SettingsLayout';

/** A controlled palette can be collapsed without leaving a browser-native popup over the dialog. */
export function ColorPickerDropdown({ label, value, onChange }: { label: string; value: string; onChange: (color: string) => void }) {
  const channels = [1, 3, 5].map(start => parseInt(value.slice(start, start + 2), 16));
  return <ColorPalettePicker label={label} value={value} onChange={onChange}>
    {['Red', 'Green', 'Blue'].map((channel, index) => <label key={channel} className="block space-y-1 text-sm">
      <span className="flex justify-between"><span>{channel}</span><span>{channels[index]}</span></span>
      <input aria-label={`${label} ${channel.toLowerCase()}`} className={SETTINGS_SLIDER} type="range" min="0" max="255" step="1" value={channels[index]}
        onChange={event => {
          const next = [...channels]; next[index] = Number(event.currentTarget.value);
          onChange(`#${next.map(n => n.toString(16).padStart(2, '0')).join('')}`);
        }} />
    </label>)}
  </ColorPalettePicker>;
}
