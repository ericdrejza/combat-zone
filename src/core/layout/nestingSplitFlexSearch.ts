import type { LayoutPoint } from './types';
import type {
  NestingActor,
  PolygonNestingInput,
  PolygonNestingSettings
} from './nesting_ts';
import {
  distance,
  footprintsOverlap,
  getFootprint,
  isFootprintInsideZone
} from './polygonGeometry';
import { getNestingCandidatePoints } from './nestingCandidates';
import { getTargetPoint } from './nestingTargets';
import { respectsSplitOrdering } from './nestingSplitFlex';

/**
 * Repositions earlier factions when the greedy pass leaves a boundary with
 * no candidate. The search is only used after that fast pass fails, so normal
 * placements retain their existing deterministic behavior.
 */
export function findSplitFlexPlacements(
  input: PolygonNestingInput,
  settings: PolygonNestingSettings,
  borderSpacing: number,
  actors: NestingActor[],
  actorIndexes: Map<string, number>,
  splitTargets: Map<string, LayoutPoint>
): Record<string, LayoutPoint> | undefined {
  const placements: Record<string, LayoutPoint> = {};
  const placedFootprints: LayoutPoint[][] = [];
  const candidateCache = new Map<string, LayoutPoint[]>();
  let searchNodes = 0;
  const maxSearchNodes = Math.max(5000, actors.length * 2500);

  const getCandidates = (actor: NestingActor): LayoutPoint[] => {
    const cached = candidateCache.get(actor.id);

    if (cached) {
      return cached;
    }

    const actorIndex = actorIndexes.get(actor.id) ?? 0;
    const target =
      actor.id === input.incomingActorId && input.incomingDropPoint
        ? input.incomingDropPoint
        : splitTargets.get(actor.id) ??
          getTargetPoint(
            actorIndex,
            input.actors.length,
            input.polygon,
            input.actors,
            borderSpacing,
            'SPLIT_FLEX',
            settings.actorGap
          );
    const candidates = [...getNestingCandidatePoints(
      input.polygon,
      actor,
      borderSpacing,
      target,
      settings
    )];

    // The generator is optimized for early valid candidates, while the
    // fallback needs nearby alternatives first to keep boundary movement
    // small and avoid needlessly changing the visual layout.
    candidates.sort(
      (first, second) => distance(first, target) - distance(second, target)
    );
    candidateCache.set(actor.id, candidates);
    return candidates;
  };

  const search = (actorIndex: number): boolean => {
    if (actorIndex === actors.length) {
      return true;
    }

    const actor = actors[actorIndex];

    for (const point of getCandidates(actor)) {
      searchNodes += 1;

      if (searchNodes > maxSearchNodes) {
        return false;
      }

      const footprint = getFootprint(
        actor,
        point,
        borderSpacing,
        settings.circleSegments
      );
      const collisionFootprint = getFootprint(
        actor,
        point,
        settings.actorGap / 2,
        settings.circleSegments
      );
      const valid =
        isFootprintInsideZone(footprint, input.polygon) &&
        placedFootprints.every(
          (placed) => !footprintsOverlap(collisionFootprint, placed)
        ) &&
        respectsSplitOrdering(
          actor,
          point,
          actors.slice(0, actorIndex),
          placements,
          input.layoutOrientation
        );

      if (!valid) {
        continue;
      }

      placements[actor.id] = point;
      placedFootprints.push(collisionFootprint);

      if (search(actorIndex + 1)) {
        return true;
      }

      placedFootprints.pop();
      delete placements[actor.id];
    }

    return false;
  };

  return search(0) ? placements : undefined;
}
