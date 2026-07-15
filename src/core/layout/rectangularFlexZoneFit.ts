import type { LayoutPoint } from "./types";
import { getPolygonBounds, getPolygonCenter } from "./polygonGeometry";
import {
  packRectangularFlexActors,
  type RectangularFlexLayoutInput
} from "./rectangularFlexLayout";
import type { NestingActor } from "./nesting_ts";

export type RectangularFlexZoneFit = {
  polygon: LayoutPoint[];
  resized: boolean;
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
  input: Omit<RectangularFlexLayoutInput, "polygon">,
  polygon: LayoutPoint[]
): boolean {
  return packRectangularFlexActors({ ...input, polygon }).fits;
}

/**
 * Finds the minimum uniform scale of a rectangular FLEX polygon that can fit
 * all actor footprints. Scaling around the polygon center preserves its
 * aspect ratio and keeps the result deterministic for every resize path.
 */
export function findSmallestRectangularFlexZoneFit(
  polygon: LayoutPoint[],
  actors: NestingActor[],
  settings?: RectangularFlexLayoutInput["settings"]
): RectangularFlexZoneFit | null {
  if (polygon.length < 3 || actors.length === 0) {
    return { polygon, resized: false };
  }

  const input = { actors, settings };

  if (fits(input, polygon)) {
    return { polygon, resized: false };
  }

  const center = getPolygonCenter(polygon);
  const bounds = getPolygonBounds(polygon);
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;

  if (width <= 0 || height <= 0) {
    return null;
  }

  let lowerScale = 1;
  let upperScale = 2;
  let upperScaleFits = false;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (fits(input, scalePolygon(polygon, center, upperScale))) {
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

    if (fits(input, scalePolygon(polygon, center, middleScale))) {
      upperScale = middleScale;
    } else {
      lowerScale = middleScale;
    }
  }

  return {
    polygon: scalePolygon(polygon, center, upperScale),
    resized: true
  };
}
