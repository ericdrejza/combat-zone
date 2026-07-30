import type { LayoutPoint } from '@core/layout/types';

export const ENGAGEMENT_TETHER_DISTANCE = 30;

/** Keeps the visual tether and same-zone drop behavior on one threshold. */
export function isWithinEngagementTether(
  start: LayoutPoint,
  current: LayoutPoint
): boolean {
  return Math.hypot(current.x - start.x, current.y - start.y) <=
    ENGAGEMENT_TETHER_DISTANCE;
}
