import type { Zone } from "./types";

export const ZONE_COLOR_PALETTE = [
  "#ffffff",
  "#d6d3d1",
  "#AAAAAA",
  "#765341",
  "#92400e",
  "#fef3c7",
  "#fed7aa",
  "#fecaca",
  "#fbcfe8",
  "#ddd6fe",
  "#bfdbfe",
  "#bae6fd",
  "#bbf7d0",
  "#d9f99d",
  "#991b1b",
  "#fde68a",
  "#365314",
  "#047857",
  "#1d4ed8",
  "#6d28d9"
] as const;

export const DEFAULT_ZONE_PALETTE_COLOR = ZONE_COLOR_PALETTE[0];

/** Resolves the color shared by every Engagement rendered within a Zone. */
export function getZoneEngagementColor(zone: Zone): string {
  return zone.matchEngagementColorToBorder === false
    ? (zone.colorEngagement ?? zone.colorBorder)
    : zone.colorBorder;
}
