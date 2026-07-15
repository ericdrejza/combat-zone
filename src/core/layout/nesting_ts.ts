import type { LayoutPoint } from './types';
import {
  distance,
  footprintsOverlap,
  getFootprint,
  getPolygonBounds,
  getPolygonCenter,
  isFootprintInsideZone
} from './polygonGeometry';
import { getNestingCandidatePoints } from './nestingCandidates';

export type NestingActor = {
  id: string;
  radius: number;
  shape: 'circle' | 'rectangle';
};

export type PolygonNestingSettings = {
  preferredBorderSpacing: number;
  minimumBorderSpacing: number;
  borderSpacingStep: number;
  actorGap: number;
  circleSegments: number;
  candidateStep: number;
};

export const DEFAULT_POLYGON_NESTING_SETTINGS: PolygonNestingSettings = {
  preferredBorderSpacing: 16,
  minimumBorderSpacing: 4,
  borderSpacingStep: 4,
  actorGap: 16,
  circleSegments: 16,
  candidateStep: 8
};

export type PolygonNestingInput = {
  polygon: LayoutPoint[];
  actors: NestingActor[];
  incomingActorId?: string;
  incomingDropPoint?: LayoutPoint;
  settings?: Partial<PolygonNestingSettings>;
};

export type PolygonNestingResult = {
  fits: boolean;
  placements: Record<string, LayoutPoint>;
  borderSpacing: number;
  incomingDropPoint?: LayoutPoint;
  incomingTargetPoint?: LayoutPoint;
  reason?: 'invalid-zone' | 'no-space';
};

function mergeSettings(
  settings?: Partial<PolygonNestingSettings>
): PolygonNestingSettings {
  return {
    ...DEFAULT_POLYGON_NESTING_SETTINGS,
    ...settings,
    preferredBorderSpacing: Math.max(
      0,
      settings?.preferredBorderSpacing ??
        DEFAULT_POLYGON_NESTING_SETTINGS.preferredBorderSpacing
    ),
    minimumBorderSpacing: Math.max(
      0,
      settings?.minimumBorderSpacing ??
        DEFAULT_POLYGON_NESTING_SETTINGS.minimumBorderSpacing
    ),
    borderSpacingStep: Math.max(
      0.5,
      settings?.borderSpacingStep ??
        DEFAULT_POLYGON_NESTING_SETTINGS.borderSpacingStep
    ),
    actorGap: Math.max(
      0,
      settings?.actorGap ?? DEFAULT_POLYGON_NESTING_SETTINGS.actorGap
    ),
    circleSegments: Math.max(
      8,
      Math.round(
        settings?.circleSegments ??
          DEFAULT_POLYGON_NESTING_SETTINGS.circleSegments
      )
    ),
    candidateStep: Math.max(
      1,
      settings?.candidateStep ?? DEFAULT_POLYGON_NESTING_SETTINGS.candidateStep
    )
  };
}

function getTargetPoint(
  index: number,
  count: number,
  polygon: LayoutPoint[],
  actors: NestingActor[],
  borderSpacing: number
): LayoutPoint {
  const center = getPolygonCenter(polygon);
  const bounds = getPolygonBounds(polygon);
  const largestRadius = Math.max(...actors.map((actor) => actor.radius));
  if (count === 1) {
    return center;
  }

  if (count === 2) {
    const horizontal = bounds.maxX - bounds.minX >= bounds.maxY - bounds.minY;
    const axisRadius =
      (horizontal ? bounds.maxX - bounds.minX : bounds.maxY - bounds.minY) / 2 -
      largestRadius -
      borderSpacing;
    const offset = Math.max(0, axisRadius);

    return horizontal
      ? { x: center.x + (index === 0 ? offset : -offset), y: center.y }
      : { x: center.x, y: center.y + (index === 0 ? offset : -offset) };
  }

  const ringRadius = Math.max(
    0,
    Math.min(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) / 2 -
      largestRadius -
      borderSpacing
  );
  const angle = -Math.PI / 2 + (index / count) * Math.PI * 2;

  return {
    x: center.x + Math.cos(angle) * ringRadius,
    y: center.y + Math.sin(angle) * ringRadius
  };
}

function getBorderSpacings(settings: PolygonNestingSettings): number[] {
  const maximum = Math.max(settings.preferredBorderSpacing, settings.minimumBorderSpacing);
  const values: number[] = [];

  for (let spacing = maximum; spacing >= settings.minimumBorderSpacing; spacing -= settings.borderSpacingStep) {
    values.push(spacing);
  }

  if (!values.includes(settings.minimumBorderSpacing)) {
    values.push(settings.minimumBorderSpacing);
  }

  return values;
}

function tryPack(
  input: PolygonNestingInput,
  settings: PolygonNestingSettings,
  borderSpacing: number
): PolygonNestingResult {
  const actorIndexes = new Map(
    input.actors.map((actor, index) => [actor.id, index])
  );
  // Place larger footprints first so feasibility does not depend on an actor
  // being appended to the collection after leaving and re-entering a zone.
  const actors = [...input.actors].sort(
    (first, second) =>
      second.radius - first.radius || first.id.localeCompare(second.id)
  );
  const placements: Record<string, LayoutPoint> = {};
  const placedFootprints: LayoutPoint[][] = [];

  for (const actor of actors) {
    const actorIndex = actorIndexes.get(actor.id) ?? 0;
    const target =
      actor.id === input.incomingActorId && input.incomingDropPoint
        ? input.incomingDropPoint
        : getTargetPoint(
            actorIndex,
            input.actors.length,
            input.polygon,
            input.actors,
            borderSpacing
          );
    let candidate: LayoutPoint | undefined;
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
        );

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
      getFootprint(actor, candidate, settings.actorGap / 2, settings.circleSegments)
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

/** Deterministic polygon-footprint packing used by polygon FLEX zones. */
export function packPolygonActors(input: PolygonNestingInput): PolygonNestingResult {
  const settings = mergeSettings(input.settings);

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
    const result = tryPack(input, settings, borderSpacing);

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
