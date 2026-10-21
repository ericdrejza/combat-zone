import { ColorRangeInput } from "./ColorRangeInput";
import { useEffect, useId, useRef, useState } from 'react';
import { useTheme } from '@ui/theme/ThemeProvider';
import { SETTINGS_CONTROL, SETTINGS_SLIDER } from '@ui/settings/SettingsLayout';
import { ColorPickerDropdown } from './ColorPickerDropdown';

export type ColorOpacity = { color: string | null; opacity: number };
/** The hex field accepts an alpha suffix; invalid drafts never replace the last valid color. */
export function ColorOpacityFields({ label, value, onChange, collapsiblePicker = false, keepPickerOpen = false, onValidityChange }: {
  label: string; value: ColorOpacity; onChange: (value: ColorOpacity) => void;
  keepPickerOpen?: boolean;
  collapsiblePicker?: boolean; onValidityChange?: (valid: boolean) => void;
}) {
  const { theme } = useTheme(), errorId = useId();
  const color = value.color ?? (theme === 'dark' ? '#f5f4f0' : '#24211c');
  const [hex, setHex] = useState(color), [invalid, setInvalid] = useState(false);
  const hexDirty = useRef(false);
  const latestValue = useRef(value);
  latestValue.current = value;
  // Blur and slider input can arrive before the parent's next render; merge only changed fields.
  function update(patch: Partial<ColorOpacity>) {
    const next = { ...latestValue.current, ...patch };
    latestValue.current = next;
    onChange(next);
  }
  useEffect(() => {
    if (!hexDirty.current) { setHex(color); setInvalid(false); }
  }, [color]);
  function commit() {
    if (!hexDirty.current) return;
    const text = hex.trim();
    if (!/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(text)) { setInvalid(true); onValidityChange?.(false); return; }
    const next = text.slice(0, 7).toLowerCase();
    hexDirty.current = false;
    setInvalid(false); setHex(next); onValidityChange?.(true);
    update({ color: next === color ? latestValue.current.color : next,
      ...(text.length === 9 ? { opacity: parseInt(text.slice(7), 16) / 255 } : {}) });
  }
  function chooseColor(color: string) {
    hexDirty.current = false;
    setHex(color); setInvalid(false); onValidityChange?.(true); update({ color });
  }
  return <div className="space-y-3">
    {collapsiblePicker ? <ColorPickerDropdown closeOnSelect={!keepPickerOpen} label={`${label} color`} value={color} onChange={chooseColor} /> : null}
    <div className={collapsiblePicker ? '' : 'grid grid-cols-[4rem_minmax(0,1fr)] items-end gap-3'}>
      {!collapsiblePicker ? <label className="space-y-1 text-sm">Color<input aria-label={`${label} color`} type="color" className={`${SETTINGS_CONTROL} px-1`} value={color}
        onChange={event => chooseColor(event.currentTarget.value)} /></label> : null}
      <label className="space-y-1 text-sm">Hex<input aria-label={`${label} hex color`} className={`${SETTINGS_CONTROL} font-mono`} value={hex} spellCheck={false}
        aria-invalid={invalid} aria-describedby={invalid ? errorId : undefined} onChange={event => {
          hexDirty.current = true;
          setHex(event.currentTarget.value); setInvalid(false);
          onValidityChange?.(/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(event.currentTarget.value.trim()));
        }}
        onBlur={commit} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); } }} /></label>
    </div>
    {invalid ? <p id={errorId} role="alert" className="text-sm text-red-600 dark:text-red-400">Enter #RRGGBB or #RRGGBBAA.</p> : null}
    <label className="block space-y-1 text-sm"><span className="flex justify-between">Opacity <span>{Math.round(value.opacity * 100)}%</span></span>
      <ColorRangeInput aria-label={`${label} opacity`} min={0} max={1} step={0.01} className={SETTINGS_SLIDER} value={value.opacity}
        onValueChange={opacity => update({ opacity })} /></label>
  </div>;
}
