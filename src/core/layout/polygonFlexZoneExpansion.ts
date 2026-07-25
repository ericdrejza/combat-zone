import type { LayoutPoint } from './types';
import { getMinimumZoneHeight, getMinimumZoneWidth } from './zoneSize';
import { getPolygonCenter, getPolygonBounds } from './polygonGeometry';
import type { PolygonFlexZoneFit } from './polygonFlexZoneFit';
import {
  packPolygonActors,
  type NestingActor,
  type PolygonNestingStrategy
} from './nesting_ts';
import type { LayoutOrientation } from './types';
import {
  getGenericCandidate,
  getRadialScale,
  getRectangleCandidate,
  getRectangleSideScale,
  moveSideToLimit,
  moveVertexToLimit,
  RECTANGLE_SIDES
} from './polygonFlexZoneExpansionGeometry';

type ExpansionOptions = {
  isPolygonAllowed?: (polygon: LayoutPoint[]) => boolean;
  layoutOrientation?: LayoutOrientation;
  layoutStrategy?: PolygonNestingStrategy;
  preserveRectangle?: boolean;
};

const MAX_GROWTH_ATTEMPTS = 6;
const MAX_REFINEMENT_ATTEMPTS = 6;
const RESIZE_TOLERANCE_PX = 0.5;

function fitsActors(
  polygon: LayoutPoint[],
  actors: NestingActor[],
  options: ExpansionOptions
): boolean {
  return packPolygonActors({
    actors,
    layoutOrientation: options.layoutOrientation,
    layoutStrategy: options.layoutStrategy ?? 'FLEX',
    polygon
  }).fits;
}

function isAllowed(
  polygon: LayoutPoint[],
  isPolygonAllowed?: (polygon: LayoutPoint[]) => boolean
): boolean {
  return isPolygonAllowed?.(polygon) ?? true;
}

function getMinimumScale(polygon: LayoutPoint[]): number {
  const bounds = getPolygonBounds(polygon);
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;

  return Math.max(
    1,
    getMinimumZoneWidth() / width,
    getMinimumZoneHeight() / height
  );
}

function findMinimumFitScale(
  lowerScale: number,
  upperScale: number,
  getCandidate: (scale: number) => LayoutPoint[],
  actors: NestingActor[],
  isPolygonAllowed: (polygon: LayoutPoint[]) => boolean,
  options: ExpansionOptions
): LayoutPoint[] {
  const baseBounds = getPolygonBounds(getCandidate(1));
  const largestDimension = Math.max(
    baseBounds.maxX - baseBounds.minX,
    baseBounds.maxY - baseBounds.minY
  );

  for (
    let attempt = 0;
    attempt < MAX_REFINEMENT_ATTEMPTS &&
    (upperScale - lowerScale) * largestDimension > RESIZE_TOLERANCE_PX;
    attempt += 1
  ) {
    const middleScale = (lowerScale + upperScale) / 2;
    const candidate = getCandidate(middleScale);

    if (
      isAllowed(candidate, isPolygonAllowed) &&
      fitsActors(candidate, actors, options)
    ) {
      upperScale = middleScale;
    } else {
      lowerScale = middleScale;
    }
  }

  return getCandidate(upperScale);
}

function getEstimatedFitScale(
  polygon: LayoutPoint[],
  actors: NestingActor[],
  minimumScale: number
): number {
  const bounds = getPolygonBounds(polygon);
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const footprintArea = actors.reduce(
    (total, actor) => total + (actor.radius * 2 + 16) ** 2,
    0
  );
  const densityScale = Math.sqrt(
    footprintArea / Math.max(1, width * height * 0.65)
  );
  const largestDiameter = Math.max(
    0,
    ...actors.map((actor) => actor.radius * 2 + 32)
  );

  return Math.max(
    minimumScale,
    densityScale,
    largestDiameter / Math.max(1, width),
    largestDiameter / Math.max(1, height)
  );
}

/** Expands each available vertex until actors fit or every expansion is blocked. */
export function findSmallestPolygonFlexZoneExpansion(
  polygon: LayoutPoint[],
  actors: NestingActor[],
  options: ExpansionOptions = {}
): PolygonFlexZoneFit | null {
  if (polygon.length < 3) {
    return null;
  }

  const minimumScale = getMinimumScale(polygon);

  if (!Number.isFinite(minimumScale)) {
    return null;
  }

  const origin = getPolygonCenter(polygon);
  const preserveRectangle = options.preserveRectangle && polygon.length === 4;
  const blockedScales = new Array(preserveRectangle ? 4 : polygon.length).fill(
    Number.POSITIVE_INFINITY
  );
  const isPolygonAllowed = options.isPolygonAllowed ?? (() => true);
  const getCandidate = (scale: number) =>
    preserveRectangle
      ? getRectangleCandidate(polygon, scale, blockedScales)
      : getGenericCandidate(polygon, origin, scale, blockedScales);
  const estimatedFitScale = getEstimatedFitScale(
    polygon,
    actors,
    minimumScale
  );

  let currentScale = minimumScale;
  let currentPolygon = getCandidate(currentScale);

  if (!isAllowed(currentPolygon, isPolygonAllowed)) {
    return null;
  }

  if (fitsActors(currentPolygon, actors, options)) {
    return { polygon: currentPolygon, resized: currentScale > 1 };
  }

  const activeIndices = new Set(
    Array.from({ length: blockedScales.length }, (_, index) => index)
  );

  for (let attempt = 0; attempt < MAX_GROWTH_ATTEMPTS; attempt += 1) {
    const previousScale = currentScale;
    const targetScale =
      attempt === 0
        ? Math.max(estimatedFitScale, currentScale + 1)
        : Math.max(currentScale * 2, currentScale + 1);
    const targetPolygon = getCandidate(targetScale);

    if (isAllowed(targetPolygon, isPolygonAllowed)) {
      currentPolygon = targetPolygon;
      currentScale = targetScale;
    } else {
      let movedIndex = false;
      currentPolygon = getCandidate(currentScale);

      for (const index of activeIndices) {
        if (preserveRectangle) {
          const side = RECTANGLE_SIDES[index];
          const desiredCoordinate =
            side === 'left'
              ? Math.min(...targetPolygon.map((point) => point.x))
              : side === 'right'
                ? Math.max(...targetPolygon.map((point) => point.x))
                : side === 'top'
                  ? Math.min(...targetPolygon.map((point) => point.y))
                  : Math.max(...targetPolygon.map((point) => point.y));
          const moved = moveSideToLimit(
            currentPolygon,
            side,
            desiredCoordinate,
            isPolygonAllowed
          );

          currentPolygon = moved.polygon;

          if (moved.reachedTarget) {
            movedIndex = true;
          } else {
            blockedScales[index] = getRectangleSideScale(
              currentPolygon,
              polygon,
              side
            );
            activeIndices.delete(index);
            movedIndex = true;
          }
        } else {
          const moved = moveVertexToLimit(
            currentPolygon,
            index,
            targetPolygon[index],
            isPolygonAllowed
          );

          currentPolygon = moved.polygon;

          if (moved.reachedTarget) {
            movedIndex = true;
          } else {
            blockedScales[index] = getRadialScale(
              currentPolygon[index],
              polygon[index],
              origin
            );
            activeIndices.delete(index);
            movedIndex = true;
          }
        }
      }

      if (!movedIndex) {
        return null;
      }

      currentScale = targetScale;
    }

    if (fitsActors(currentPolygon, actors, options)) {
      return {
        polygon: findMinimumFitScale(
          previousScale,
          currentScale,
          getCandidate,
          actors,
          isPolygonAllowed,
          options
        ),
        resized: true
      };
    }

    if (activeIndices.size === 0) {
      return null;
    }
  }

  return null;
}
