import type { LayoutOrientation, LayoutPoint } from './types';
import { getBorderSpacingsForInput, tryPack } from './nestingPacking';
import { getCollisionActorGap } from './nestingSpacing';
import { tryPackSplitSections } from './splitSectionPacking';

export type NestingActor = {
  id: string;
  radius: number;
  shape: 'circle' | 'rectangle';
  layoutGroup?: 'hero' | 'enemy' | 'neutral';
};

export type PolygonNestingStrategy =
  | 'FLEX'
  | 'SEQUENTIAL'
  | 'SPLIT_FLEX'
  | 'SPLIT_SEQUENTIAL';

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

export const DEFAULT_SPLIT_FLEX_ACTOR_GAP = 2;

export type PolygonNestingInput = {
  polygon: LayoutPoint[];
  actors: NestingActor[];
  layoutStrategy?: PolygonNestingStrategy;
  layoutOrientation?: LayoutOrientation;
  /** Optional per-actor targets used by layouts with an explicit axis. */
  targetPoints?: Readonly<Record<string, LayoutPoint>>;
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

function getPolygonArea(polygon: LayoutPoint[]): number {
  let doubledArea = 0;

  for (let index = 0; index < polygon.length; index += 1) {
    const point = polygon[index];
    const next = polygon[(index + 1) % polygon.length];
    doubledArea += point.x * next.y - next.x * point.y;
  }

  return Math.abs(doubledArea) / 2;
}

function getRequiredFootprintArea(
  actors: NestingActor[],
  settings: PolygonNestingSettings,
  collisionGap: number
): number {
  const circleAreaFactor =
    (settings.circleSegments *
      Math.sin((Math.PI * 2) / settings.circleSegments)) /
    2;

  return actors.reduce((total, actor) => {
    const radius = actor.radius + collisionGap / 2;

    return (
      total +
      (actor.shape === 'rectangle'
        ? (radius * 2) ** 2
        : circleAreaFactor * radius ** 2)
    );
  }, 0);
}

function mergeSettings(
  settings: Partial<PolygonNestingSettings> | undefined,
  defaultActorGap: number
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
    actorGap: Math.max(0, settings?.actorGap ?? defaultActorGap),
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

/** Resolves strategy-specific defaults for both synchronous and worker packing. */
export function resolvePolygonNestingSettings(
  input: Pick<PolygonNestingInput, 'layoutStrategy' | 'settings'>
): PolygonNestingSettings {
  const layoutStrategy = input.layoutStrategy ?? 'FLEX';

  return mergeSettings(
    input.settings,
    layoutStrategy === 'SPLIT_FLEX'
      ? DEFAULT_SPLIT_FLEX_ACTOR_GAP
      : DEFAULT_POLYGON_NESTING_SETTINGS.actorGap
  );
}

/** Deterministic polygon-footprint packing used by polygon layouts. */
export function packPolygonActors(input: PolygonNestingInput): PolygonNestingResult {
  const settings = resolvePolygonNestingSettings(input);
  const collisionGap = getCollisionActorGap(
    input.layoutStrategy,
    settings.actorGap,
    input.actors.length
  );

  if (input.polygon.length < 3) {
    return {
      fits: false,
      placements: {},
      borderSpacing: settings.minimumBorderSpacing,
      incomingDropPoint: input.incomingDropPoint,
      reason: 'invalid-zone'
    };
  }

  // Non-overlapping collision footprints cannot fit when their combined area
  // already exceeds the zone. This prevents exhaustive candidate scans for
  // obviously undersized polygons during automatic-resize searches.
  if (
    getRequiredFootprintArea(input.actors, settings, collisionGap) >
    getPolygonArea(input.polygon)
  ) {
    return {
      fits: false,
      placements: {},
      borderSpacing: settings.minimumBorderSpacing,
      incomingDropPoint: input.incomingDropPoint,
      reason: 'no-space'
    };
  }

  for (const borderSpacing of getBorderSpacingsForInput(input, settings)) {
    const result =
      input.layoutStrategy === 'SPLIT_FLEX'
        ? tryPackSplitSections(input, settings, borderSpacing, 'FLEX')
        : input.layoutStrategy === 'SPLIT_SEQUENTIAL'
          ? tryPackSplitSections(input, settings, borderSpacing, 'SEQUENTIAL')
        : tryPack(input, settings, borderSpacing);

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
