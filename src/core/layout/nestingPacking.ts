import {
  getFootprint,
  isFootprintInsideZone
} from './polygonGeometry';
import { getNestingCandidatePoints } from './nestingCandidates';
import { getTargetPoints } from './nestingTargets';
import { NestingSpatialIndex } from './nestingSpatialIndex';
import { getCollisionActorGap } from './nestingSpacing';
import { getDenseRectangleSpacings } from './nestingRectangleCapacity';
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

/** Tries comfortable edge clearance before progressively denser packing. */
export function getBorderSpacingsForInput(
  input: Pick<PolygonNestingInput, 'actors' | 'layoutStrategy' | 'polygon'>,
  settings: PolygonNestingSettings
): number[] {
  const spacings = getBorderSpacings(settings);

  return (
    getDenseRectangleSpacings(
      input,
      spacings,
      settings.minimumBorderSpacing
    ) ?? spacings
  );
}

export function tryPack(
  input: PolygonNestingInput,
  settings: PolygonNestingSettings,
  borderSpacing: number
): PolygonNestingResult {
  const layoutStrategy = input.layoutStrategy ?? 'FLEX';
  const collisionGap = getCollisionActorGap(
    input.layoutStrategy,
    settings.actorGap,
    input.actors.length
  );
  const actorIndexes = new Map(
    input.actors.map((actor, index) => [actor.id, index])
  );
  const actors = [...input.actors].sort(
    (first, second) =>
      second.radius - first.radius ||
      (actorIndexes.get(first.id) ?? 0) - (actorIndexes.get(second.id) ?? 0)
  );
  const targets = getTargetPoints(
    input.actors,
    input.polygon,
    borderSpacing,
    layoutStrategy,
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
  const placements: Record<string, { x: number; y: number }> = {};
  const maximumRadius = Math.max(1, ...actors.map((actor) => actor.radius));
  const spatialIndex = new NestingSpatialIndex(
    maximumRadius * 2 + collisionGap,
    settings.circleSegments
  );

  for (let placedActorCount = 0; placedActorCount < actors.length; placedActorCount += 1) {
    const actor = actors[placedActorCount];
    const actorIndex = actorIndexes.get(actor.id) ?? 0;
    const target =
      actor.id === input.incomingActorId && input.incomingDropPoint
        ? input.incomingDropPoint
        : input.targetPoints?.[actor.id] ?? targets[actorIndex];
    let candidate: { x: number; y: number } | undefined;

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
      const collisionFootprint = spatialIndex.createFootprint(
        actor,
        point,
        collisionGap / 2
      );
      const valid =
        isFootprintInsideZone(footprint, input.polygon) &&
        !spatialIndex.overlaps(collisionFootprint);

      if (!valid) {
        continue;
      }

      candidate = point;
      break;
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
      spatialIndex.createFootprint(actor, candidate, collisionGap / 2)
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
