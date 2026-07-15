import type { LayoutPoint } from '@core/layout/types';

type SectionBounds = {
  height: number;
  width: number;
  x: number;
  y: number;
};

export type SectionActor = {
  radius: number;
};

const SECTION_ACTOR_GAP = 16;

function getAxisSize(bounds: SectionBounds, vertical: boolean): number {
  return vertical ? bounds.height : bounds.width;
}

function getAxisStart(bounds: SectionBounds, vertical: boolean): number {
  return vertical ? bounds.y : bounds.x;
}

function getCrossAxisCenter(
  bounds: SectionBounds,
  vertical: boolean
): number {
  return vertical
    ? bounds.x + bounds.width / 2
    : bounds.y + bounds.height / 2;
}

function pointOnSectionAxis(
  bounds: SectionBounds,
  vertical: boolean,
  axisPosition: number
): LayoutPoint {
  return vertical
    ? { x: getCrossAxisCenter(bounds, true), y: axisPosition }
    : { x: axisPosition, y: getCrossAxisCenter(bounds, false) };
}

function getEvenlySpacedAxisPositions(
  actors: SectionActor[],
  bounds: SectionBounds,
  vertical: boolean
): number[] {
  const axisStart = getAxisStart(bounds, vertical);
  const axisSize = getAxisSize(bounds, vertical);
  const maxRadius = Math.max(...actors.map((actor) => actor.radius));
  const first = axisStart + maxRadius + SECTION_ACTOR_GAP;
  const last = axisStart + axisSize - maxRadius - SECTION_ACTOR_GAP;

  if (actors.length === 1 || last <= first) {
    return [axisStart + axisSize / 2];
  }

  return actors.map((_, index) =>
    first + ((last - first) * index) / (actors.length - 1)
  );
}

function getSequentialAxisPositions(
  actors: SectionActor[],
  bounds: SectionBounds,
  vertical: boolean
): number[] {
  const axisStart = getAxisStart(bounds, vertical);
  const axisSize = getAxisSize(bounds, vertical);
  const maxRadius = Math.max(...actors.map((actor) => actor.radius));
  const spacing = maxRadius * 2 + SECTION_ACTOR_GAP;
  const totalSpan = spacing * (actors.length - 1);
  const first = axisStart + axisSize / 2 - totalSpan / 2;
  const minPosition = axisStart + maxRadius;
  const maxPosition = axisStart + axisSize - maxRadius;

  return actors.map((_, index) =>
    Math.max(minPosition, Math.min(maxPosition, first + spacing * index))
  );
}

/** Lays split-section actors along the axis perpendicular to the section split. */
export function getSectionActorPoints(
  actors: SectionActor[],
  bounds: SectionBounds,
  vertical: boolean,
  flex: boolean
): LayoutPoint[] {
  if (actors.length === 0) {
    return [];
  }

  const axisPositions = flex
    ? getEvenlySpacedAxisPositions(actors, bounds, vertical)
    : getSequentialAxisPositions(actors, bounds, vertical);

  return axisPositions.map((position) =>
    pointOnSectionAxis(bounds, vertical, position)
  );
}
