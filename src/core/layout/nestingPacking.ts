import {
  distance,
  footprintsOverlap,
  getFootprint,
  isFootprintInsideZone
} from './polygonGeometry';
import { getNestingCandidatePoints } from './nestingCandidates';
import { getTargetPoint } from './nestingTargets';
import {
  getSplitFlexTargetPoints,
  getSplitGroupRank,
  hasValidSplitOrdering,
  respectsSplitOrdering
} from './nestingSplitFlex';
import { findSplitFlexPlacements } from './nestingSplitFlexSearch';
import type {
  NestingActor,
  PolygonNestingInput,
  PolygonNestingResult,
  PolygonNestingSettings
} from './nesting_ts';

export function getBorderSpacings(settings: PolygonNestingSettings): number[] {
  const maximum = Math.max(
    settings.preferredBorderSpacing,
    settings.minimumBorderSpacing
  );
  const values: number[] = [];

  for (
    let spacing = maximum;
    spacing >= settings.minimumBorderSpacing;
    spacing -= settings.borderSpacingStep
  ) {
    values.push(spacing);
  }

  if (!values.includes(settings.minimumBorderSpacing)) {
    values.push(settings.minimumBorderSpacing);
  }

  return values;
}

export function tryPack(
  input: PolygonNestingInput,
  settings: PolygonNestingSettings,
  borderSpacing: number
): PolygonNestingResult {
  const layoutStrategy = input.layoutStrategy ?? 'FLEX';
  const splitFlex = layoutStrategy === 'SPLIT_FLEX';
  const actorIndexes = new Map(
    input.actors.map((actor, index) => [actor.id, index])
  );
  const splitTargets = splitFlex
    ? getSplitFlexTargetPoints(input, borderSpacing, settings.actorGap)
    : undefined;
  const actors = [...input.actors].sort(
    (first, second) =>
      (splitFlex
        ? getSplitGroupRank(first) - getSplitGroupRank(second)
        : 0) ||
      second.radius - first.radius ||
      (actorIndexes.get(first.id) ?? 0) - (actorIndexes.get(second.id) ?? 0)
  );
  const placements: Record<string, { x: number; y: number }> = {};
  const placedFootprints: Array<Array<{ x: number; y: number }>> = [];

  for (const actor of actors) {
    const actorIndex = actorIndexes.get(actor.id) ?? 0;
    const target =
      actor.id === input.incomingActorId && input.incomingDropPoint
        ? input.incomingDropPoint
        : input.targetPoints?.[actor.id]
        ?? splitTargets?.get(actor.id)
        ?? getTargetPoint(
          actorIndex,
          input.actors.length,
          input.polygon,
          input.actors,
          borderSpacing,
          layoutStrategy,
          settings.actorGap
        );
    let candidate: { x: number; y: number } | undefined;
    let candidateDistance = Number.POSITIVE_INFINITY;

    for (const point of getNestingCandidatePoints(
      input.polygon,
      actor,
      borderSpacing,
      target,
      settings
    )) {
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
        (!splitFlex ||
          respectsSplitOrdering(
            actor,
            point,
            actors.slice(0, actors.indexOf(actor)),
            placements,
            input.layoutOrientation
          ));

      if (!valid) {
        continue;
      }

      const pointDistance = distance(point, target);

      if (pointDistance < candidateDistance) {
        candidate = point;
        candidateDistance = pointDistance;

        if (candidateDistance === 0) {
          break;
        }
      }
    }

    if (!candidate) {
      if (splitFlex) {
        const splitPlacements = findSplitFlexPlacements(
          input,
          settings,
          borderSpacing,
          actors,
          actorIndexes,
          splitTargets ?? new Map()
        );

        if (splitPlacements) {
          return {
            fits: true,
            placements: splitPlacements,
            borderSpacing,
            incomingDropPoint: input.incomingDropPoint,
            incomingTargetPoint: input.incomingActorId
              ? splitPlacements[input.incomingActorId]
              : undefined
          };
        }
      }

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

  if (
    splitFlex &&
    !hasValidSplitOrdering(input.actors, placements, input.layoutOrientation)
  ) {
    return {
      fits: false,
      placements: {},
      borderSpacing,
      incomingDropPoint: input.incomingDropPoint,
      reason: 'no-space'
    };
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
