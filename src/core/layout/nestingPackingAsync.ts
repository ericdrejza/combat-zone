import { getNestingCandidatePoints } from './nestingCandidates';
import {
  getFootprint,
  isFootprintInsideZone
} from './polygonGeometry';
import { getTargetPoints } from './nestingTargets';
import { getBorderSpacingsForInput } from './nestingPacking';
import { getCollisionActorGap } from './nestingSpacing';
import { NestingSpatialIndex } from './nestingSpatialIndex';
import { resolvePolygonLayoutInput } from './effectiveLayoutStrategy';
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
  input = resolvePolygonLayoutInput(input);
  if (
    input.layoutStrategy === 'SPLIT_FLEX' ||
    input.layoutStrategy === 'SPLIT_SEQUENTIAL'
  ) {
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

  for (const borderSpacing of getBorderSpacingsForInput(input, settings)) {
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

  // Include the shared size-aware fallback before rejecting a ranked search.
  return packPolygonActors(input);
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
  const collisionGap = getCollisionActorGap(
    input.layoutStrategy,
    settings.actorGap,
    input.actors.length
  );
  const targets = getTargetPoints(
    input.actors,
    input.polygon,
    borderSpacing,
    input.layoutStrategy ?? 'FLEX',
    settings.actorGap
  );

  if (
    targets.length !== input.actors.length &&
    !input.actors.every((actor) => input.targetPoints?.[actor.id])
  ) {
    return {
      fits: false,
      placements: {},
      borderSpacing,
      incomingDropPoint: input.incomingDropPoint,
      reason: 'no-space'
    };
  }
  const placements: Record<string, LayoutPoint> = {};
  const spatialIndex = new NestingSpatialIndex(
    Math.max(1, ...actors.map((actor) => actor.radius)) * 2 + collisionGap,
    settings.circleSegments
  );

  for (const actor of actors) {
    const actorIndex = actorIndexes.get(actor.id) ?? 0;
    const target =
      actor.id === input.incomingActorId && input.incomingDropPoint
        ? input.incomingDropPoint
        : input.targetPoints?.[actor.id] ??
          targets[actorIndex];
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
      const collisionFootprint = spatialIndex.createFootprint(
        actor,
        point,
        collisionGap / 2
      );

      if (
        isFootprintInsideZone(footprint, input.polygon) &&
        !spatialIndex.overlaps(collisionFootprint)
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
    spatialIndex.insert(
      spatialIndex.createFootprint(
        actor,
        candidate,
        collisionGap / 2
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
