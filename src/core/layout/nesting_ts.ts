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

export type PolygonNestingStrategy = 'FLEX' | 'SEQUENTIAL';

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
  layoutStrategy?: PolygonNestingStrategy;
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
  borderSpacing: number,
  layoutStrategy: PolygonNestingStrategy,
  actorGap: number
): LayoutPoint {
  const center = getPolygonCenter(polygon);
  const bounds = getPolygonBounds(polygon);
  const largestRadius = Math.max(...actors.map((actor) => actor.radius));
  const requiredActorSpacing = largestRadius * 2 + actorGap;
  if (count === 1) {
    return center;
  }

  if (layoutStrategy === 'SEQUENTIAL' && isAxisAlignedRectangle(polygon)) {
    return getSequentialRectangleTargets(
      actors,
      bounds,
      borderSpacing,
      actorGap
    )[index] ?? center;
  }

  if (layoutStrategy === 'SEQUENTIAL') {
    const outerRadius = Math.max(
      0,
      Math.min(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) / 2 -
        largestRadius -
        borderSpacing
    );
    const actorSpacing = largestRadius * 2 + actorGap;
    const angleStep =
      outerRadius <= 0
        ? Math.PI * 2
        : Math.max(
            2 *
              Math.asin(
                Math.min(1, actorSpacing / (2 * outerRadius))
              ),
            Math.PI / 24
          );
    const angle = -Math.PI / 2 + index * angleStep;

    return {
      x: center.x + Math.cos(angle) * outerRadius,
      y: center.y + Math.sin(angle) * outerRadius
    };
  }

  if (count === 2) {
    const horizontal = bounds.maxX - bounds.minX >= bounds.maxY - bounds.minY;
    const axisRadius = Math.max(
      0,
      (horizontal ? bounds.maxX - bounds.minX : bounds.maxY - bounds.minY) / 2 -
        largestRadius -
        borderSpacing
    );
    // Put the pair where the free space at the edge and between the actors
    // are comparable. Using the maximum radius here gives smaller actors the
    // same stable distribution target while the final footprint check still
    // accounts for their actual sizes.
    const offset = Math.min(
      axisRadius,
      (axisRadius + requiredActorSpacing) / 3
    );

    return horizontal
      ? { x: center.x + (index === 0 ? offset : -offset), y: center.y }
      : { x: center.x, y: center.y + (index === 0 ? offset : -offset) };
  }

  const maximumXRadius = Math.max(
    0,
    (bounds.maxX - bounds.minX) / 2 - largestRadius - borderSpacing
  );
  const maximumYRadius = Math.max(
    0,
    (bounds.maxY - bounds.minY) / 2 - largestRadius - borderSpacing
  );
  const limitingRadius = Math.min(maximumXRadius, maximumYRadius);
  const chordFactor = 2 * Math.sin(Math.PI / count);
  const balancedLimitingRadius = Math.min(
    limitingRadius,
    (limitingRadius + requiredActorSpacing) / (1 + chordFactor)
  );
  const radialScale =
    limitingRadius > 0 ? balancedLimitingRadius / limitingRadius : 0;
  const ringRadiusX = maximumXRadius * radialScale;
  const ringRadiusY = maximumYRadius * radialScale;
  const angle = -Math.PI / 2 + (index / count) * Math.PI * 2;

  return {
    x: center.x + Math.cos(angle) * ringRadiusX,
    y: center.y + Math.sin(angle) * ringRadiusY
  };
}

type SequentialRectangleRow = {
  actors: NestingActor[];
  width: number;
  maxRadius: number;
};

/**
 * Creates row-major targets from the collection order. Each row is an
 * independent horizontal line, so different actor sizes cannot cause the
 * candidate search to move one actor off the row occupied by its neighbors.
 */
function getSequentialRectangleTargets(
  actors: NestingActor[],
  bounds: ReturnType<typeof getPolygonBounds>,
  borderSpacing: number,
  actorGap: number
): LayoutPoint[] {
  const usableWidth = bounds.maxX - bounds.minX - borderSpacing * 2;
  const rows: SequentialRectangleRow[] = [];

  for (const actor of actors) {
    const actorWidth = actor.radius * 2;
    const currentRow = rows[rows.length - 1];
    const widthWithActor = currentRow
      ? currentRow.width + actorGap + actorWidth
      : actorWidth;

    if (currentRow && widthWithActor > usableWidth) {
      rows.push({
        actors: [actor],
        width: actorWidth,
        maxRadius: actor.radius
      });
      continue;
    }

    if (currentRow) {
      currentRow.actors.push(actor);
      currentRow.width = widthWithActor;
      currentRow.maxRadius = Math.max(currentRow.maxRadius, actor.radius);
      continue;
    }

    rows.push({
      actors: [actor],
      width: actorWidth,
      maxRadius: actor.radius
    });
  }

  const usableHeight = bounds.maxY - bounds.minY - borderSpacing * 2;
  const totalHeight = rows.reduce(
    (height, row) => height + row.maxRadius * 2,
    0
  ) + Math.max(0, rows.length - 1) * actorGap;
  let rowTop =
    bounds.minY +
    borderSpacing +
    Math.max(0, (usableHeight - totalHeight) / 2);
  const targets: LayoutPoint[] = [];

  for (const row of rows) {
    let actorLeft =
      bounds.minX +
      borderSpacing +
      Math.max(0, (usableWidth - row.width) / 2);
    const rowCenterY = rowTop + row.maxRadius;

    for (const actor of row.actors) {
      targets.push({
        x: actorLeft + actor.radius,
        y: rowCenterY
      });
      actorLeft += actor.radius * 2 + actorGap;
    }

    rowTop += row.maxRadius * 2 + actorGap;
  }

  return targets;
}

function isAxisAlignedRectangle(polygon: LayoutPoint[]): boolean {
  if (polygon.length !== 4) {
    return false;
  }

  const bounds = getPolygonBounds(polygon);
  const uniqueX = new Set(polygon.map((point) => point.x));
  const uniqueY = new Set(polygon.map((point) => point.y));

  return (
    uniqueX.size === 2 &&
    uniqueY.size === 2 &&
    polygon.every(
      (point) =>
        (point.x === bounds.minX || point.x === bounds.maxX) &&
        (point.y === bounds.minY || point.y === bounds.maxY)
    )
  );
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
  const layoutStrategy = input.layoutStrategy ?? 'FLEX';
  const actorIndexes = new Map(
    input.actors.map((actor, index) => [actor.id, index])
  );
  // Place larger footprints first, preserving collection order for equal-sized
  // actors. The stable tie-break is important because proactive planning uses
  // a placeholder ID for the future actor; IDs must not change its geometry.
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
        : getTargetPoint(
            actorIndex,
            input.actors.length,
          input.polygon,
          input.actors,
          borderSpacing,
          layoutStrategy,
          settings.actorGap
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
