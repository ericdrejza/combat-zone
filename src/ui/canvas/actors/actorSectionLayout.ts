import type { LayoutPoint } from '@core/layout/types';

export type SectionBounds = {
  height: number;
  width: number;
  x: number;
  y: number;
};

export type SectionActor = {
  radius: number;
};

const SECTION_ACTOR_GAP = 16;
const SECTION_EDGE_GAP = 16;

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

function getSectionCapacity(
  bounds: SectionBounds,
  vertical: boolean,
  maxRadius: number
): number {
  const available = getAxisSize(bounds, vertical) - SECTION_EDGE_GAP * 2;
  const occupied = maxRadius * 2 + SECTION_ACTOR_GAP;

  return Math.max(1, Math.floor((available + SECTION_ACTOR_GAP) / occupied));
}

/** Returns the minimum size along the split axis required by a section. */
export function getSectionRequiredAxisSize(
  actors: SectionActor[],
  bounds: SectionBounds,
  vertical: boolean
): number {
  if (actors.length === 0) {
    return 0;
  }

  const maxRadius = Math.max(...actors.map((actor) => actor.radius));
  const actorsPerColumn = getSectionCapacity(bounds, vertical, maxRadius);
  const columns = Math.ceil(actors.length / actorsPerColumn);

  return (
    columns * maxRadius * 2 +
    Math.max(0, columns - 1) * SECTION_ACTOR_GAP +
    SECTION_EDGE_GAP * 2
  );
}

function clipPolygonAgainstAxis(
  polygon: LayoutPoint[],
  vertical: boolean,
  boundary: number,
  keepGreater: boolean
): LayoutPoint[] {
  const result: LayoutPoint[] = [];
  const coordinate = (point: LayoutPoint) =>
    vertical ? point.y : point.x;
  const inside = (point: LayoutPoint) =>
    keepGreater
      ? coordinate(point) >= boundary
      : coordinate(point) <= boundary;

  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index];
    const previous = polygon[(index + polygon.length - 1) % polygon.length];
    const currentInside = inside(current);
    const previousInside = inside(previous);

    if (currentInside !== previousInside) {
      const previousCoordinate = coordinate(previous);
      const currentCoordinate = coordinate(current);
      const ratio =
        (boundary - previousCoordinate) /
        (currentCoordinate - previousCoordinate);

      result.push({
        x: previous.x + (current.x - previous.x) * ratio,
        y: previous.y + (current.y - previous.y) * ratio
      });
    }

    if (currentInside) {
      result.push(current);
    }
  }

  return result;
}

/** Clips the zone polygon to one rectangular split-section boundary. */
export function getSplitSectionPolygon(
  polygon: LayoutPoint[],
  bounds: SectionBounds
): LayoutPoint[] {
  let clipped = polygon;

  clipped = clipPolygonAgainstAxis(clipped, false, bounds.x, true);
  clipped = clipPolygonAgainstAxis(
    clipped,
    false,
    bounds.x + bounds.width,
    false
  );
  clipped = clipPolygonAgainstAxis(clipped, true, bounds.y, true);
  clipped = clipPolygonAgainstAxis(
    clipped,
    true,
    bounds.y + bounds.height,
    false
  );

  return clipped;
}

function getSectionGridPoints(
  actors: SectionActor[],
  bounds: SectionBounds,
  vertical: boolean
): LayoutPoint[] {
  const maxRadius = Math.max(...actors.map((actor) => actor.radius));
  const actorsPerColumn = getSectionCapacity(bounds, vertical, maxRadius);
  const columns = Math.ceil(actors.length / actorsPerColumn);
  const rows = Math.ceil(actors.length / columns);
  const columnPositions = getEvenlySpacedAxisPositions(
    Array.from({ length: columns }, () => ({ radius: maxRadius })),
    bounds,
    !vertical
  );
  const rowPositions = getEvenlySpacedAxisPositions(
    Array.from({ length: rows }, () => ({ radius: maxRadius })),
    bounds,
    vertical
  );

  return actors.map((_, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const axisPosition = columnPositions[column];
    const crossAxisPosition = rowPositions[row];

    return vertical
      ? { x: axisPosition, y: crossAxisPosition }
      : { x: crossAxisPosition, y: axisPosition };
  });
}

/** Places split-section actors in a centered, evenly spaced grid. */
export function getSectionActorPoints(
  actors: SectionActor[],
  bounds: SectionBounds,
  vertical: boolean
): LayoutPoint[] {
  if (actors.length === 0) {
    return [];
  }

  return getSectionGridPoints(actors, bounds, vertical);
}
