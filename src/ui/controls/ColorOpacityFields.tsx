import { useRef } from "react";
import { useTheme } from "@ui/theme/ThemeProvider";
import { SETTINGS_SLIDER } from "@ui/settings/SettingsLayout";
import { ColorPicker } from "./ColorPicker";
import { ColorRangeInput } from "./ColorRangeInput";

export type ColorOpacity = { color: string | null; opacity: number };

/** Compose the shared color picker with opacity; partial changes never overwrite a newer sibling value. */
export function ColorOpacityFields({ label, value, onChange, keepPickerOpen = false, allowColorReset = false, onValidityChange }: {
  label: string;
  value: ColorOpacity;
  onChange: (value: ColorOpacity) => void;
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
  return <div className="space-y-3">
    <ColorPicker label={`${label} color`} value={value.color} allowAlpha
      fallbackColor={theme === "dark" ? "#f5f4f0" : "#24211c"}
      resetValue={allowColorReset ? null : undefined} closeOnSelect={!keepPickerOpen}
      onValidityChange={onValidityChange}
      onChange={(color, opacity) => update({ color, ...(opacity !== undefined ? { opacity } : {}) })} />
    <label className="block space-y-1 text-sm"><span className="flex justify-between">Opacity <span>{Math.round(value.opacity * 100)}%</span></span>
      <ColorRangeInput aria-label={`${label} opacity`} min={0} max={1} step={0.01} className={SETTINGS_SLIDER} value={value.opacity}
        onValueChange={opacity => update({ opacity })} /></label>
  </div>;
}
