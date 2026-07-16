import { getNestingCandidatePoints } from './nestingCandidates';
import {
  footprintsOverlap,
  getFootprint,
  isFootprintInsideZone
} from './polygonGeometry';
import { getTargetPoint } from './nestingTargets';
import { getBorderSpacings } from './nestingPacking';
import type { LayoutPoint } from './types';
import {
  resolvePolygonNestingSettings,
  packPolygonActors,
  type NestingActor,
  type PolygonNestingInput,
  type PolygonNestingResult
} from './nesting_ts';

/**
 * Orders candidates by distance to their target. The ranker may use a GPU,
 * while the CPU still performs the authoritative geometry checks below.
 */
export type NestingCandidateRanker = (
  candidates: LayoutPoint[],
  target: LayoutPoint
) => Promise<LayoutPoint[]>;

/**
 * Packs non-split layouts with an asynchronous candidate ranker. Keeping the
 * geometry checks on the CPU preserves the exact existing layout invariant;
 * hardware acceleration only changes how candidate distances are calculated.
 */
export async function packPolygonActorsWithCandidateRanker(
  input: PolygonNestingInput,
  rankCandidates: NestingCandidateRanker
): Promise<PolygonNestingResult> {
  if (input.layoutStrategy === 'SPLIT_FLEX') {
    return packPolygonActors(input);
  }

  const settings = resolvePolygonNestingSettings(input);

  if (input.polygon.length < 3) {
    return {
      fits: false,
      placements: {},
      borderSpacing: settings.minimumBorderSpacing,
      incomingDropPoint: input.incomingDropPoint,
      reason: 'invalid-zone'
    };
  }

  for (const borderSpacing of getBorderSpacings(settings)) {
    const result = await tryPackWithRanker(
      input,
      settings,
      borderSpacing,
      rankCandidates
    );

    if (result.fits) {
      return result;
    }
  }

  return {
    fits: false,
    placements: {},
    borderSpacing: settings.minimumBorderSpacing,
    incomingDropPoint: input.incomingDropPoint,
    reason: 'no-space'
  };
}

async function tryPackWithRanker(
  input: PolygonNestingInput,
  settings: ReturnType<typeof resolvePolygonNestingSettings>,
  borderSpacing: number,
  rankCandidates: NestingCandidateRanker
): Promise<PolygonNestingResult> {
  const actorIndexes = new Map(
    input.actors.map((actor, index) => [actor.id, index])
  );
  const actors = [...input.actors].sort(
    (first, second) =>
      second.radius - first.radius ||
      (actorIndexes.get(first.id) ?? 0) - (actorIndexes.get(second.id) ?? 0)
  );
  const placements: Record<string, LayoutPoint> = {};
  const placedFootprints: LayoutPoint[][] = [];

  for (const actor of actors) {
    const actorIndex = actorIndexes.get(actor.id) ?? 0;
    const target =
      actor.id === input.incomingActorId && input.incomingDropPoint
        ? input.incomingDropPoint
        : input.targetPoints?.[actor.id] ??
          getTargetPoint(
            actorIndex,
            input.actors.length,
            input.polygon,
            input.actors,
            borderSpacing,
            input.layoutStrategy ?? 'FLEX',
            settings.actorGap
          );
    const candidates = Array.from(
      getNestingCandidatePoints(
        input.polygon,
        actor,
        borderSpacing,
        target,
        settings
      )
    );
    const rankedCandidates = await rankCandidates(candidates, target);
    let candidate: LayoutPoint | undefined;

    for (const point of rankedCandidates) {
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

      if (
        isFootprintInsideZone(footprint, input.polygon) &&
        placedFootprints.every(
          (placed) => !footprintsOverlap(collisionFootprint, placed)
        )
      ) {
        candidate = point;
        break;
      }
    }

    if (!candidate) {
      return {
        fits: false,
        placements,
        borderSpacing,
        incomingDropPoint: input.incomingDropPoint,
        reason: 'no-space'
      };
    }

    placements[actor.id] = candidate;
    placedFootprints.push(
      getFootprint(
        actor,
        candidate,
        settings.actorGap / 2,
        settings.circleSegments
      )
    );
  }

  return {
    fits: true,
    placements,
    borderSpacing,
    incomingDropPoint: input.incomingDropPoint,
    incomingTargetPoint: input.incomingActorId
      ? placements[input.incomingActorId]
      : undefined
  };
}
