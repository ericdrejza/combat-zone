import type { LayoutOrientation, LayoutPoint } from './types';
import { getBorderSpacings, tryPack } from './nestingPacking';

export type NestingActor = {
  id: string;
  radius: number;
  shape: 'circle' | 'rectangle';
  layoutGroup?: 'hero' | 'enemy' | 'neutral';
};

export type PolygonNestingStrategy = 'FLEX' | 'SEQUENTIAL' | 'SPLIT_FLEX';

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
