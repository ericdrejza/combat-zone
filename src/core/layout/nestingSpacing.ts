import type { PolygonNestingStrategy } from './nesting_ts';

export const MINIMUM_FLEX_ACTOR_GAP = 2;

/**
 * Dense FLEX layouts reduce their preferred clearance without allowing
 * rendered footprints to touch. The small floor also absorbs SVG edge and
 * circle-approximation artifacts that can otherwise look like overlap.
 */
export function getCollisionActorGap(
  layoutStrategy: PolygonNestingStrategy | undefined,
  configuredGap: number,
  actorCount: number
): number {
  return (layoutStrategy ?? 'FLEX') === 'FLEX' && actorCount >= 8
    ? MINIMUM_FLEX_ACTOR_GAP
    : configuredGap;
}
