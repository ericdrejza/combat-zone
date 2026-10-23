import { useRef } from "react";
import { useTheme } from "@ui/theme/ThemeProvider";
import { SETTINGS_SLIDER } from "@ui/settings/SettingsLayout";
import { ColorPicker } from "./ColorPicker";
import { ColorRangeInput } from "./ColorRangeInput";

export type ColorOpacity = { color: string | null; opacity: number };

/** Compose the shared color picker with opacity; partial changes never overwrite a newer sibling value. */
export function ColorOpacityFields({ label, value, onChange, keepPickerOpen = false, allowColorReset = false, onCommit, onCancel, opacityStep = 0.01, onValidityChange }: {
  label: string;
  value: ColorOpacity;
  onChange: (value: ColorOpacity) => void;
  onCommit?: (value: ColorOpacity) => void;
  onCancel?: () => void;
  opacityStep?: number | 'any';
  keepPickerOpen?: boolean;
  allowColorReset?: boolean;
  onValidityChange?: (valid: boolean) => void;
}) {
  const { theme } = useTheme();
  const latestValue = useRef(value);
  latestValue.current = value;
  function update(patch: Partial<ColorOpacity>) {
    const next = { ...latestValue.current, ...patch };
    latestValue.current = next;
    onChange(next);
  }
  function commit(patch: Partial<ColorOpacity>) { onCommit?.({ ...latestValue.current, ...patch }); }
  return <div className="space-y-3">
    <ColorPicker label={`${label} color`} value={value.color} allowAlpha
      fallbackColor={theme === "dark" ? "#f5f4f0" : "#24211c"}
      resetValue={allowColorReset ? null : undefined} closeOnSelect={!keepPickerOpen}
      onValidityChange={onValidityChange}
      onCancel={onCancel} onCommit={(color, opacity) => commit({ color, ...(opacity !== undefined ? { opacity } : {}) })}
      onChange={(color, opacity) => update({ color, ...(opacity !== undefined ? { opacity } : {}) })} />
    <label className="block space-y-1 text-sm"><span className="flex justify-between">Opacity <span>{Math.round(value.opacity * 100)}%</span></span>
      <ColorRangeInput aria-label={`${label} opacity`} min={0} max={1} step={opacityStep} className={SETTINGS_SLIDER} value={value.opacity}
        onValueCommit={opacity => commit({ opacity })} onValueCancel={onCancel} onBlur={event => commit({ opacity: Number(event.currentTarget.value) })}
        onValueChange={opacity => update({ opacity })} /></label>
  </div>;
}
