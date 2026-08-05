import type { LayoutPoint } from "./types";
import { getPolygonBounds, getPolygonCenter } from "./polygonGeometry";
import {
  getMinimumZoneHeight,
  getMinimumZoneWidth
} from "./zoneSize";
import type { PolygonFlexLayoutInput } from "./polygonFlexLayout";
import {
  packPolygonActors,
  type NestingActor,
  type PolygonNestingStrategy
} from "./nesting_ts";

export type PolygonFlexZoneFit = {
  polygon: LayoutPoint[];
  resized: boolean;
};

export type PolygonFlexZoneFitOptions = {
  anchor?: LayoutPoint;
  isAdditionalLayoutFit?: (polygon: LayoutPoint[]) => boolean;
  isPolygonAllowed?: (polygon: LayoutPoint[]) => boolean;
  layoutOrientation?: PolygonFlexLayoutInput["layoutOrientation"];
  layoutStrategy?: PolygonNestingStrategy;
};

const MAX_GROWTH_ATTEMPTS = 6;
const MAX_REFINEMENT_ATTEMPTS = 6;
const RESIZE_TOLERANCE_PX = 0.5;

function scalePolygon(
  polygon: LayoutPoint[],
  center: LayoutPoint,
  scale: number
): LayoutPoint[] {
  return polygon.map((point) => ({
    x: center.x + (point.x - center.x) * scale,
    y: center.y + (point.y - center.y) * scale
  }));
}

function fits(
  input: Omit<PolygonFlexLayoutInput, "polygon">,
  polygon: LayoutPoint[],
  options: PolygonFlexZoneFitOptions
): boolean {
  return (
    (options.isPolygonAllowed?.(polygon) ?? true) &&
    packPolygonActors({
      ...input,
      layoutOrientation: options.layoutOrientation,
      layoutStrategy: options.layoutStrategy ?? "FLEX",
      polygon
    }).fits &&
    (options.isAdditionalLayoutFit?.(polygon) ?? true)
  );
}

function findLargestAllowedScale(
  polygon: LayoutPoint[],
  origin: LayoutPoint,
  lowerScale: number,
  upperScale: number,
  isPolygonAllowed: (polygon: LayoutPoint[]) => boolean
): number {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const middleScale = (lowerScale + upperScale) / 2;

    if (isPolygonAllowed(scalePolygon(polygon, origin, middleScale))) {
      lowerScale = middleScale;
    } else {
      upperScale = middleScale;
    }
  }

  return lowerScale;
}

function isWithinPixelTolerance(
  polygon: LayoutPoint[],
  lowerScale: number,
  upperScale: number
): boolean {
  const bounds = getPolygonBounds(polygon);
  const largestDimension = Math.max(
    bounds.maxX - bounds.minX,
    bounds.maxY - bounds.minY
  );

  return (upperScale - lowerScale) * largestDimension <= RESIZE_TOLERANCE_PX;
}

/**
 * Finds the minimum uniform scale of a polygon FLEX zone that can fit all
 * actor footprints. Scaling around the polygon center preserves the shape's
 * proportions and keeps the result deterministic for every resize path.
 */
export function findSmallestPolygonFlexZoneFit(
  polygon: LayoutPoint[],
  actors: NestingActor[],
  settings?: PolygonFlexLayoutInput["settings"],
  options: PolygonFlexZoneFitOptions = {}
): PolygonFlexZoneFit | null {
  if (polygon.length < 3) {
    return null;
  }

  const input = { actors, settings };
  const bounds = getPolygonBounds(polygon);
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;

  if (width <= 0 || height <= 0) {
    return null;
  }

  const scaleOrigin = options.anchor ?? getPolygonCenter(polygon);
  const minimumScale = Math.max(
    1,
    getMinimumZoneWidth() / width,
    getMinimumZoneHeight() / height
  );
  const minimumPolygon = scalePolygon(polygon, scaleOrigin, minimumScale);

  if (fits(input, minimumPolygon, options)) {
    return {
      polygon: minimumPolygon,
      resized: minimumScale > 1
    };
  }

  let lowerScale = minimumScale;
  let upperScale = Math.max(2, minimumScale * 2);
  let upperScaleFits = false;

  for (let attempt = 0; attempt < MAX_GROWTH_ATTEMPTS; attempt += 1) {
    const upperPolygon = scalePolygon(polygon, scaleOrigin, upperScale);

    if (fits(input, upperPolygon, options)) {
      upperScaleFits = true;
      break;
    }

    if (
      options.isPolygonAllowed &&
      !options.isPolygonAllowed(upperPolygon)
    ) {
      const largestAllowedScale = findLargestAllowedScale(
        polygon,
        scaleOrigin,
        lowerScale,
        upperScale,
        options.isPolygonAllowed
      );

      if (
        largestAllowedScale > lowerScale &&
        fits(input, scalePolygon(polygon, scaleOrigin, largestAllowedScale), options)
      ) {
        upperScale = largestAllowedScale;
        upperScaleFits = true;
      }
      break;
    }

    upperScale *= 2;
  }

  if (!upperScaleFits) {
    return null;
  }

  for (
    let attempt = 0;
    attempt < MAX_REFINEMENT_ATTEMPTS &&
    !isWithinPixelTolerance(polygon, lowerScale, upperScale);
    attempt += 1
  ) {
    const middleScale = (lowerScale + upperScale) / 2;

    if (
      fits(input, scalePolygon(polygon, scaleOrigin, middleScale), options)
    ) {
      upperScale = middleScale;
    } else {
      lowerScale = middleScale;
    }
  }

  return {
    polygon: scalePolygon(polygon, scaleOrigin, upperScale),
    resized: true
  };
}
