import type { LayoutPoint } from "./types";
import { getPolygonBounds, getPolygonCenter } from "./polygonGeometry";
import {
  getMinimumZoneHeight,
  getMinimumZoneWidth
} from "./zoneSize";
import {
  packPolygonFlexActors,
  type PolygonFlexLayoutInput
} from "./polygonFlexLayout";
import type { NestingActor } from "./nesting_ts";

export type PolygonFlexZoneFit = {
  polygon: LayoutPoint[];
  resized: boolean;
};

export type PolygonFlexZoneFitOptions = {
  anchor?: LayoutPoint;
  isPolygonAllowed?: (polygon: LayoutPoint[]) => boolean;
};

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
  isPolygonAllowed?: (polygon: LayoutPoint[]) => boolean
): boolean {
  return (
    packPolygonFlexActors({ ...input, polygon }).fits &&
    (isPolygonAllowed?.(polygon) ?? true)
  );
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

  if (fits(input, minimumPolygon, options.isPolygonAllowed)) {
    return {
      polygon: minimumPolygon,
      resized: minimumScale > 1
    };
  }

  let lowerScale = minimumScale;
  let upperScale = Math.max(2, minimumScale * 2);
  let upperScaleFits = false;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (
      fits(
        input,
        scalePolygon(polygon, scaleOrigin, upperScale),
        options.isPolygonAllowed
      )
    ) {
      upperScaleFits = true;
      break;
    }

    upperScale *= 2;
  }

  if (!upperScaleFits) {
    return null;
  }

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const middleScale = (lowerScale + upperScale) / 2;

    if (
      fits(
        input,
        scalePolygon(polygon, scaleOrigin, middleScale),
        options.isPolygonAllowed
      )
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
