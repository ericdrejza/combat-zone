import type { PolygonNestingStrategy } from './nesting_ts';

export const MINIMUM_ACTOR_GAP = 4;
/** @deprecated Use MINIMUM_ACTOR_GAP. */
export const MINIMUM_FLEX_ACTOR_GAP = MINIMUM_ACTOR_GAP;

/**
 * All layouts retain this hard collision floor. Dense FLEX layouts reduce
 * their preferred clearance to it, while explicit per-layout spacing can
 * request a more open arrangement.
 */
export function getCollisionActorGap(
  layoutStrategy: PolygonNestingStrategy | undefined,
  configuredGap: number,
  actorCount: number
): number {
  const preferredGap =
    (layoutStrategy ?? 'FLEX') === 'FLEX' && actorCount >= 8
    ? MINIMUM_FLEX_ACTOR_GAP
    : configuredGap;

  return Math.max(MINIMUM_ACTOR_GAP, preferredGap);
}
