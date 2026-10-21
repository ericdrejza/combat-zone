import { COLOR_PICKER_PRESETS } from "@ui/controls/colorPickerPresets";

export const RECENT_CUSTOM_COLOR_LIMIT = 7;
const presets = new Set<string>(COLOR_PICKER_PRESETS.map(color => color.toLowerCase()));

/** Custom colors are unique, newest first, and never duplicate the fixed presets. */
export function readRecentCustomColors(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((color): color is string => typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color))
    .map(color => color.toLowerCase()).filter(color => !presets.has(color)))].slice(0, RECENT_CUSTOM_COLOR_LIMIT);
}
