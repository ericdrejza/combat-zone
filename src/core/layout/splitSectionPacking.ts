import { tryPack } from './nestingPacking';
import {
  buildSplitSectionsAtBoundaries,
  getSplitLayoutSections,
  type SplitLayoutSection
} from './splitSectionLayout';
import { getCenteredSplitSequentialTargets } from './splitSequentialTargets';
import { getPolygonBounds } from './polygonGeometry';
import type {
  PolygonNestingInput,
  PolygonNestingResult,
  PolygonNestingSettings
} from './nesting_ts';
import type { LayoutPoint } from './types';

type InternalStrategy = 'FLEX' | 'SEQUENTIAL';

export type FittingSplitSectionPacking = {
  placements: Record<string, LayoutPoint>;
  sections: SplitLayoutSection[];
};

function packSections(
  input: PolygonNestingInput,
  settings: PolygonNestingSettings,
  borderSpacing: number,
  internalStrategy: InternalStrategy,
  sections: SplitLayoutSection[]
): FittingSplitSectionPacking | undefined {
  const placements: Record<string, LayoutPoint> = {};

  for (const section of sections) {
    const targetPoints =
      internalStrategy === 'SEQUENTIAL'
        ? getCenteredSplitSequentialTargets(
            section.actors,
            section.bounds,
            borderSpacing,
            settings.actorGap
          )
        : undefined;
    const includesIncoming = section.actors.some(
      (actor) => actor.id === input.incomingActorId
    );
    const result = tryPack(
      {
        ...input,
        actors: section.actors,
        incomingActorId: includesIncoming ? input.incomingActorId : undefined,
        incomingDropPoint: includesIncoming
          ? input.incomingDropPoint
          : undefined,
        layoutStrategy: 'FLEX',
        polygon: section.polygon,
        targetPoints
      },
      settings,
      borderSpacing
    );

    if (!result.fits) {
      return undefined;
    }

    Object.assign(placements, result.placements);
  }

  return { placements, sections };
}

function sectionFits(
  input: PolygonNestingInput,
  settings: PolygonNestingSettings,
  borderSpacing: number,
  internalStrategy: InternalStrategy,
  section: SplitLayoutSection
): boolean {
  return Boolean(
    packSections(
      { ...input, incomingActorId: undefined, incomingDropPoint: undefined },
      settings,
      borderSpacing,
      internalStrategy,
      [section]
    )
  );
}

function findOuterBoundary(
  input: PolygonNestingInput,
  settings: PolygonNestingSettings,
  borderSpacing: number,
  internalStrategy: InternalStrategy,
  templates: SplitLayoutSection[],
  first: boolean
): number | undefined {
  const bounds = getPolygonBounds(input.polygon);
  const topBottom = input.layoutOrientation === 'TOP_BOTTOM';
  const axisStart = topBottom ? bounds.minY : bounds.minX;
  const axisEnd = topBottom ? bounds.maxY : bounds.maxX;
  let lower = axisStart;
  let upper = axisEnd;

  const getSection = (boundary: number) => {
    const allBoundaries = first
      ? [boundary, ...Array(Math.max(0, templates.length - 2)).fill(axisEnd)]
      : [
          ...Array(Math.max(0, templates.length - 2)).fill(axisStart),
          boundary
        ];

    return buildSplitSectionsAtBoundaries(
      input,
      templates,
      allBoundaries
    )[first ? 0 : templates.length - 1];
  };

  if (!sectionFits(
    input,
    settings,
    borderSpacing,
    internalStrategy,
    getSection(first ? axisEnd : axisStart)
  )) {
    return undefined;
  }

  for (let attempt = 0; attempt < 12 && upper - lower > 0.25; attempt += 1) {
    const middle = (lower + upper) / 2;
    const fits = sectionFits(
      input,
      settings,
      borderSpacing,
      internalStrategy,
      getSection(middle)
    );

    if (first === fits) {
      upper = middle;
    } else {
      lower = middle;
    }
  }

  return first ? upper : lower;
}

/**
 * Finds actual fitting boundaries first, then approaches the area-weighted
 * preference as far as every isolated section continues to fit.
 */
export function getFittingSplitSectionPacking(
  input: PolygonNestingInput,
  settings: PolygonNestingSettings,
  borderSpacing: number,
  internalStrategy: InternalStrategy
): FittingSplitSectionPacking | undefined {
  const preferred = getSplitLayoutSections(input, settings, borderSpacing);
  const preferredPacking = packSections(
    input,
    settings,
    borderSpacing,
    internalStrategy,
    preferred
  );

  if (preferredPacking || preferred.length <= 1) {
    return preferredPacking;
  }

  const topBottom = input.layoutOrientation === 'TOP_BOTTOM';
  const preferredBoundaries = preferred
    .slice(0, -1)
    .map((section) =>
      topBottom ? section.bounds.maxY : section.bounds.maxX
    );
  const firstBoundary = findOuterBoundary(
    input,
    settings,
    borderSpacing,
    internalStrategy,
    preferred,
    true
  );
  const lastBoundary = findOuterBoundary(
    input,
    settings,
    borderSpacing,
    internalStrategy,
    preferred,
    false
  );

  if (
    firstBoundary === undefined ||
    lastBoundary === undefined ||
    firstBoundary > lastBoundary
  ) {
    return undefined;
  }

  const fittingBoundaries =
    preferred.length === 2
      ? [
          Math.min(
            lastBoundary,
            Math.max(firstBoundary, preferredBoundaries[0])
          )
        ]
      : [firstBoundary, lastBoundary];
  let fitting = packSections(
    input,
    settings,
    borderSpacing,
    internalStrategy,
    buildSplitSectionsAtBoundaries(input, preferred, fittingBoundaries)
  );

  if (!fitting) {
    return undefined;
  }

  let lower = 0;
  let upper = 1;

  for (let attempt = 0; attempt < 10 && upper - lower > 0.001; attempt += 1) {
    const ratio = (lower + upper) / 2;
    const boundaries = fittingBoundaries.map(
      (boundary, index) =>
        boundary + (preferredBoundaries[index] - boundary) * ratio
    );
    const candidate = packSections(
      input,
      settings,
      borderSpacing,
      internalStrategy,
      buildSplitSectionsAtBoundaries(input, preferred, boundaries)
    );

    if (candidate) {
      lower = ratio;
      fitting = candidate;
    } else {
      upper = ratio;
    }
  }

  return fitting;
}

/** Packs every section independently using fit-first malleable boundaries. */
export function tryPackSplitSections(
  input: PolygonNestingInput,
  settings: PolygonNestingSettings,
  borderSpacing: number,
  internalStrategy: InternalStrategy
): PolygonNestingResult {
  const fitting = getFittingSplitSectionPacking(
    input,
    settings,
    borderSpacing,
    internalStrategy
  );

  return fitting
    ? {
        fits: true,
        placements: fitting.placements,
        borderSpacing,
        incomingDropPoint: input.incomingDropPoint,
        incomingTargetPoint: input.incomingActorId
          ? fitting.placements[input.incomingActorId]
          : undefined,
        splitSections: fitting.sections.map((section) => ({ id: section.id, polygon: section.polygon }))
      }
    : {
        fits: false,
        placements: {},
        borderSpacing,
        incomingDropPoint: input.incomingDropPoint,
        reason: 'no-space'
      };
}
