import type { LayoutPoint } from './types';
import {
  DEFAULT_POLYGON_NESTING_SETTINGS,
  packPolygonActors,
  type NestingActor,
  type PolygonNestingResult,
  type PolygonNestingSettings
} from './nesting_ts';

export type RectangularFlexLayoutInput = {
  polygon: LayoutPoint[];
  actors: NestingActor[];
  incomingActorId?: string;
  incomingDropPoint?: LayoutPoint;
  settings?: Partial<PolygonNestingSettings>;
};

export const RECTANGULAR_FLEX_LAYOUT_SETTINGS =
  DEFAULT_POLYGON_NESTING_SETTINGS;

/**
 * Adapter boundary for the rectangular FLEX strategy. Other zone shapes can
 * opt into the same polygon contract without changing validation callers.
 */
export function packRectangularFlexActors(
  input: RectangularFlexLayoutInput
): PolygonNestingResult {
  return packPolygonActors(input);
}
