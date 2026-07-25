import { getFittingSplitSectionPacking } from './splitSectionPacking';
import type {
  PolygonNestingInput,
  PolygonNestingSettings
} from './nesting_ts';
import {
  packPolygonActors,
  resolvePolygonNestingSettings
} from './nesting_ts';
import type { LayoutPoint } from './types';

export type SplitSectionDivider = {
  end: LayoutPoint;
  start: LayoutPoint;
};

/**
 * Returns the shared boundaries between active split sections. Callers can
 * clip these bounds-spanning lines to the zone polygon when rendering.
 */
export function getSplitSectionDividers(
  input: PolygonNestingInput,
  settings: PolygonNestingSettings,
  borderSpacing: number
): SplitSectionDivider[] {
  const internalStrategy =
    input.layoutStrategy === 'SPLIT_SEQUENTIAL' ? 'SEQUENTIAL' : 'FLEX';
  const sections =
    getFittingSplitSectionPacking(
      input,
      settings,
      borderSpacing,
      internalStrategy
    )?.sections ?? [];
  const topBottom = input.layoutOrientation === 'TOP_BOTTOM';

  return sections.slice(0, -1).map((section) =>
    topBottom
      ? {
          start: { x: section.bounds.minX, y: section.bounds.maxY },
          end: { x: section.bounds.maxX, y: section.bounds.maxY }
        }
      : {
          start: { x: section.bounds.maxX, y: section.bounds.minY },
          end: { x: section.bounds.maxX, y: section.bounds.maxY }
        }
  );
}

/** Returns dividers for the same spacing fallback used by actor packing. */
export function getFittingSplitSectionDividers(
  input: PolygonNestingInput
): SplitSectionDivider[] {
  const settings = resolvePolygonNestingSettings(input);
  const packing = packPolygonActors(input);

  return getSplitSectionDividers(
    input,
    settings,
    packing.borderSpacing
  );
}
