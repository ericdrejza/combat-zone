import { useEffect, useId, useState } from 'react';
import { useTheme } from '@ui/theme/ThemeProvider';
import { SETTINGS_CONTROL, SETTINGS_SLIDER } from '@ui/settings/SettingsLayout';
import { ColorPickerDropdown } from './ColorPickerDropdown';

export type ColorOpacity = { color: string | null; opacity: number };
/** The hex field accepts an alpha suffix; invalid drafts never replace the last valid color. */
export function ColorOpacityFields({ label, value, onChange, collapsiblePicker = false, onValidityChange }: {
  label: string; value: ColorOpacity; onChange: (value: ColorOpacity) => void;
  collapsiblePicker?: boolean; onValidityChange?: (valid: boolean) => void;
}) {
  const { theme } = useTheme(), errorId = useId();
  const color = value.color ?? (theme === 'dark' ? '#f5f4f0' : '#24211c');
  const [hex, setHex] = useState(color), [invalid, setInvalid] = useState(false);
  useEffect(() => { setHex(color); setInvalid(false); }, [color]);
  function commit() {
    const text = hex.trim();
    if (!/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(text)) { setInvalid(true); onValidityChange?.(false); return; }
    const next = text.slice(0, 7).toLowerCase();
    setInvalid(false); setHex(next); onValidityChange?.(true);
    onChange({ color: next === color ? value.color : next, opacity: text.length === 9 ? parseInt(text.slice(7), 16) / 255 : value.opacity });
  }
  function chooseColor(color: string) {
    setHex(color); setInvalid(false); onValidityChange?.(true); onChange({ ...value, color });
  }
  return <div className="space-y-3">
    {collapsiblePicker ? <ColorPickerDropdown label={`${label} color`} value={color} onChange={chooseColor} /> : null}
    <div className={collapsiblePicker ? '' : 'grid grid-cols-[4rem_minmax(0,1fr)] items-end gap-3'}>
      {!collapsiblePicker ? <label className="space-y-1 text-sm">Color<input aria-label={`${label} color`} type="color" className={`${SETTINGS_CONTROL} px-1`} value={color}
        onChange={event => onChange({ ...value, color: event.currentTarget.value })} /></label> : null}
      <label className="space-y-1 text-sm">Hex<input aria-label={`${label} hex color`} className={`${SETTINGS_CONTROL} font-mono`} value={hex} spellCheck={false}
        aria-invalid={invalid} aria-describedby={invalid ? errorId : undefined} onChange={event => {
          setHex(event.currentTarget.value); setInvalid(false);
          onValidityChange?.(/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(event.currentTarget.value.trim()));
        }}
        onBlur={commit} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); } }} /></label>
    </div>
    {invalid ? <p id={errorId} role="alert" className="text-sm text-red-600 dark:text-red-400">Enter #RRGGBB or #RRGGBBAA.</p> : null}
    <label className="block space-y-1 text-sm"><span className="flex justify-between">Opacity <span>{Math.round(value.opacity * 100)}%</span></span>
      <input aria-label={`${label} opacity`} type="range" min="0" max="1" step="0.01" className={SETTINGS_SLIDER} value={value.opacity}
        onChange={event => onChange({ ...value, opacity: Number(event.currentTarget.value) })} /></label>
  </div>;
}
