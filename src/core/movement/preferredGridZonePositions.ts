import type { EncounterState } from '@core/encounter/types';
import type { LayoutPoint } from '@core/layout/types';
import type { Actor } from '@entities/actor/types';
import { assignPreferredGridCells } from './gridCellPacking';
import { actorAnchorCells, anchorKey, canvasAnchors, pointDistance, pointOrder } from './gridTopology';
import { GRID_SPACING } from './gridScale';

/**
 * Find exact nearest choices in a bounded world-space neighborhood first.
 * A point within its inscribed circle cannot lose to an anchor outside the
 * search rectangle. Conflicts and warped geometry retain the exhaustive solver.
 */
export function preferredGridZonePositions(state: EncounterState, actors: Actor[],
  goalFor: (actor: Actor) => LayoutPoint, fits: (actor: Actor, point: LayoutPoint) => boolean
): Map<number, LayoutPoint> | null {
  if (state.grid.warp) return null;
  const radius = GRID_SPACING * 2;
  const candidates = actors.map(actor => {
    const goal = goalFor(actor);
    const anchors = canvasAnchors(state, actor.size, {
      minX: goal.x - radius, minY: goal.y - radius,
      maxX: goal.x + radius, maxY: goal.y + radius
    }).filter(point => pointDistance(point, goal) <= radius && fits(actor, point))
      .sort((a, b) => pointDistance(a, goal) - pointDistance(b, goal) || pointOrder(a, b));
    const point = anchors[0];
    return point ? [{ point, cells: actorAnchorCells(state, point, actor.size).map(cell => anchorKey(cell.center)) }] : [];
  });
  return assignPreferredGridCells(candidates);
}
