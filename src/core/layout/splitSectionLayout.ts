import { getSplitSectionSizes } from './splitSectionSizing';
import { getPolygonBounds } from './polygonGeometry';
import type {
  NestingActor,
  PolygonNestingInput,
  PolygonNestingSettings
} from './nesting_ts';
import type { LayoutPoint } from './types';

export type SplitSectionId = string;

export type SplitSectionBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

export type SplitLayoutSection = {
  actors: NestingActor[];
  bounds: SplitSectionBounds;
  id: SplitSectionId;
  polygon: LayoutPoint[];
};

export function getSplitGroupRank(actor: NestingActor): number {
  return actor.layoutGroup === 'ally' || actor.layoutGroup === 'hero'
    ? 0
    : actor.layoutGroup === 'neutral'
      ? 1
      : actor.layoutGroup === 'enemy'
        ? 2
        : 1;
}

function getSectionId(rank: number): SplitSectionId {
  return rank === 0 ? 'hero' : rank === 2 ? 'enemy' : 'neutral';
}

function getActorArea(actor: NestingActor): number {
  return actor.shape === 'rectangle'
    ? (actor.radius * 2) ** 2
    : Math.PI * actor.radius ** 2;
}

function getRequiredAxisSize(
  actors: NestingActor[],
  crossAxisSize: number,
  borderSpacing: number,
  actorGap: number
): number {
  const largestRadius = Math.max(...actors.map((actor) => actor.radius));
  const diameter = largestRadius * 2;
  const usableCrossAxis = Math.max(0, crossAxisSize - borderSpacing * 2);
  const actorsPerLine = Math.max(
    1,
    Math.floor((usableCrossAxis + actorGap) / (diameter + actorGap))
  );
  const lineCount = Math.ceil(actors.length / actorsPerLine);

  return (
    lineCount * diameter +
    Math.max(0, lineCount - 1) * actorGap +
    borderSpacing * 2
  );
}

function clipPolygonAgainstAxis(
  polygon: LayoutPoint[],
  vertical: boolean,
  boundary: number,
  keepGreater: boolean
): LayoutPoint[] {
  const result: LayoutPoint[] = [];
  const coordinate = (point: LayoutPoint) => (vertical ? point.y : point.x);
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
      const ratio =
        (boundary - previousCoordinate) /
        (coordinate(current) - previousCoordinate);

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

export function clipPolygonToSection(
  polygon: LayoutPoint[],
  bounds: SplitSectionBounds
): LayoutPoint[] {
  let clipped = clipPolygonAgainstAxis(polygon, false, bounds.minX, true);
  clipped = clipPolygonAgainstAxis(clipped, false, bounds.maxX, false);
  clipped = clipPolygonAgainstAxis(clipped, true, bounds.minY, true);

  return clipPolygonAgainstAxis(clipped, true, bounds.maxY, false);
}

/** Derives isolated, area-weighted section polygons for both split layouts. */
export function getSplitLayoutSections(
  input: Pick<
    PolygonNestingInput,
    'actors' | 'layoutOrientation' | 'polygon' | 'splitSectionOrder'
  >,
  settings: PolygonNestingSettings,
  borderSpacing: number
): SplitLayoutSection[] {
  const polygonBounds = getPolygonBounds(input.polygon);
  const topBottom = input.layoutOrientation === 'TOP_BOTTOM';
  const axisStart = topBottom ? polygonBounds.minY : polygonBounds.minX;
  const axisSize = topBottom
    ? polygonBounds.maxY - polygonBounds.minY
    : polygonBounds.maxX - polygonBounds.minX;
  const crossAxisSize = topBottom
    ? polygonBounds.maxX - polygonBounds.minX
    : polygonBounds.maxY - polygonBounds.minY;
  const defaultOrder = ['hero', 'neutral', 'enemy'];
  const sectionIdFor = (actor: NestingActor) =>
    actor.splitSectionId ?? getSectionId(getSplitGroupRank(actor));
  const orderedIds = [
    ...(input.splitSectionOrder ?? defaultOrder),
    ...input.actors.map(sectionIdFor)
  ].filter((id, index, values) => values.indexOf(id) === index);
  const groups = orderedIds.flatMap((id) => {
    const actors = input.actors.filter((actor) => sectionIdFor(actor) === id);
    return actors.length > 0 ? [{ actors, id }] : [];
  });
  const sizes = getSplitSectionSizes(
    groups.map(({ actors }) => ({
      actorArea: actors.reduce(
        (total, actor) => total + getActorArea(actor),
        0
      ),
      minimumSize: getRequiredAxisSize(
        actors,
        crossAxisSize,
        borderSpacing,
        settings.actorGap
      )
    })),
    axisSize
  );
  let cursor = axisStart;

  return groups.map(({ actors, id }, index) => {
    const sectionEnd = cursor + sizes[index];
    const bounds: SplitSectionBounds = topBottom
      ? {
          minX: polygonBounds.minX,
          maxX: polygonBounds.maxX,
          minY: cursor,
          maxY: sectionEnd
        }
      : {
          minX: cursor,
          maxX: sectionEnd,
          minY: polygonBounds.minY,
          maxY: polygonBounds.maxY
        };
    const section = {
      actors,
      bounds,
      id,
      polygon: clipPolygonToSection(input.polygon, bounds)
    };
    cursor = sectionEnd;

    return section;
  });
}

/** Rebuilds the same ordered sections around a caller-selected boundary set. */
export function buildSplitSectionsAtBoundaries(
  input: Pick<PolygonNestingInput, 'layoutOrientation' | 'polygon'>,
  templates: SplitLayoutSection[],
  boundaries: number[]
): SplitLayoutSection[] {
  const polygonBounds = getPolygonBounds(input.polygon);
  const topBottom = input.layoutOrientation === 'TOP_BOTTOM';
  const axisStart = topBottom ? polygonBounds.minY : polygonBounds.minX;
  const axisEnd = topBottom ? polygonBounds.maxY : polygonBounds.maxX;
  const stops = [axisStart, ...boundaries, axisEnd];

  return templates.map((template, index) => {
    const bounds: SplitSectionBounds = topBottom
      ? {
          minX: polygonBounds.minX,
          maxX: polygonBounds.maxX,
          minY: stops[index],
          maxY: stops[index + 1]
        }
      : {
          minX: stops[index],
          maxX: stops[index + 1],
          minY: polygonBounds.minY,
          maxY: polygonBounds.maxY
        };

    return {
      ...template,
      bounds,
      polygon: clipPolygonToSection(input.polygon, bounds)
    };
  });
}
