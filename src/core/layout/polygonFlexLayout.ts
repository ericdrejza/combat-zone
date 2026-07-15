import type { LayoutPoint } from './types';
import {
  DEFAULT_POLYGON_NESTING_SETTINGS,
  packPolygonActors,
  type NestingActor,
  type PolygonNestingResult,
  type PolygonNestingSettings
} from './nesting_ts';

export type PolygonFlexLayoutInput = {
  polygon: LayoutPoint[];
  actors: NestingActor[];
  incomingActorId?: string;
  incomingDropPoint?: LayoutPoint;
  settings?: Partial<PolygonNestingSettings>;
};

export const POLYGON_FLEX_LAYOUT_SETTINGS =
  DEFAULT_POLYGON_NESTING_SETTINGS;

/**
 * Application boundary for polygon-footprint FLEX placement. Every zone shape
 * is represented by a polygon, so the same strategy works for rectangles,
 * circles, hexagons, and user-drawn polygons.
 */
export function packPolygonFlexActors(
  input: PolygonFlexLayoutInput
): PolygonNestingResult {
  return packPolygonActors(input);
}
