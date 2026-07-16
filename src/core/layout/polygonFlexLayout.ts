import type { LayoutOrientation, LayoutPoint } from './types';
import {
  DEFAULT_POLYGON_NESTING_SETTINGS,
  packPolygonActors,
  type PolygonNestingStrategy,
  type NestingActor,
  type PolygonNestingResult,
  type PolygonNestingSettings
} from './nesting_ts';

export type PolygonFlexLayoutInput = {
  polygon: LayoutPoint[];
  actors: NestingActor[];
  layoutOrientation?: LayoutOrientation;
  targetPoints?: Readonly<Record<string, LayoutPoint>>;
  incomingActorId?: string;
  incomingDropPoint?: LayoutPoint;
  settings?: Partial<PolygonNestingSettings>;
};

export type PolygonLayoutInput = PolygonFlexLayoutInput;

export const POLYGON_FLEX_LAYOUT_SETTINGS =
  DEFAULT_POLYGON_NESTING_SETTINGS;
export const POLYGON_LAYOUT_SETTINGS = POLYGON_FLEX_LAYOUT_SETTINGS;

/**
 * Application boundary for polygon-footprint FLEX placement. Every zone shape
 * is represented by a polygon, so the same strategy works for rectangles,
 * circles, hexagons, and user-drawn polygons.
 */
export function packPolygonFlexActors(
  input: PolygonFlexLayoutInput
): PolygonNestingResult {
  return packPolygonActors({ ...input, layoutStrategy: 'FLEX' });
}

/** Packs one full zone while preserving FLEX distribution and faction order. */
export function packPolygonSplitFlexActors(
  input: PolygonFlexLayoutInput
): PolygonNestingResult {
  return packPolygonActors({ ...input, layoutStrategy: 'SPLIT_FLEX' });
}

/** Uses the same polygon packer while preserving collection order as a clockwise sequence. */
export function packPolygonSequentialActors(
  input: PolygonLayoutInput
): PolygonNestingResult {
  const layoutStrategy: PolygonNestingStrategy = 'SEQUENTIAL';

  return packPolygonActors({ ...input, layoutStrategy });
}
