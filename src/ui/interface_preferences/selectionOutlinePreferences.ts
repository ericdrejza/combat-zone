import { ZONE_BORDER_WIDTH } from "@ui/canvas/zones/zoneRenderingConstants";
import type { SelectionOutlineMode } from "@core/rendering/SelectionOutline";

/** Legacy and unsupported preferences retain the static selection default. */
export function readSelectionOutlineMode(value: unknown): SelectionOutlineMode {
  return value === "pulse" || value === "pulse_limited" ? value : "static";
}

export const MIN_SELECTION_OUTLINE_WIDTH = 1;
export const MAX_SELECTION_OUTLINE_WIDTH = 8;
export const DEFAULT_ACTOR_SELECTION_OUTLINE_WIDTH = 2;
export const DEFAULT_ZONE_SELECTION_OUTLINE_WIDTH = 3;
export const DEFAULT_EDGE_THICKNESS = 1;
export const DEFAULT_ZONE_BORDER_THICKNESS = ZONE_BORDER_WIDTH;
export const DEFAULT_ACTOR_BORDER_THICKNESS = 2;

/** Unsupported widths preserve the existing default for that entity type. */
export function readSelectionOutlineWidth(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value >= MIN_SELECTION_OUTLINE_WIDTH && value <= MAX_SELECTION_OUTLINE_WIDTH
    ? value
    : fallback;
}
