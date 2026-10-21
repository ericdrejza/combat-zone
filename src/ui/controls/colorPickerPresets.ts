import { ZONE_COLOR_PALETTE } from "@entities/zone/zoneColors";
import { hexToHsv } from "./colorSpectrum";

/** Three rows of seven: neutrals light to dark, then colors around the hue wheel. */
export const COLOR_PICKER_PRESETS = [...ZONE_COLOR_PALETTE, "#000000", "#ef4444", "#3b82f6"].filter(color => !["#fde68a", "#fecaca"].includes(color.toLowerCase())).sort((left, right) => {
  const a = hexToHsv(left), b = hexToHsv(right);
  const neutralA = a.s < 0.08, neutralB = b.s < 0.08;
  if (neutralA !== neutralB) return neutralA ? -1 : 1;
  return (neutralA ? 0 : a.h - b.h) || b.v - a.v || a.s - b.s;
});
