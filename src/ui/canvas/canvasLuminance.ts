import type { LayoutPoint } from "../../core/layout/types";
import type { Zone } from "../../entities/zone/types";
import {
  BACKGROUND_SAMPLE_COUNT,
  CANVAS_BACKGROUND_COLOR,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  LOW_ZONE_OPACITY_THRESHOLD
} from "./canvasConstants";
import { getPolygonBounds, isPointInPolygon } from "./zoneGeometry";

export function getReadableTextColor(backgroundColor: string): string {
  return getTextColorForLuminance(getHexLuminance(backgroundColor));
}

export function getTextColorForLuminance(luminance: number): string {
  return luminance > 128 ? "#111827" : "#ffffff";
}

export function getHexLuminance(backgroundColor: string): number {
  const normalizedColor = backgroundColor.replace("#", "");
  const red = Number.parseInt(normalizedColor.slice(0, 2), 16);
  const green = Number.parseInt(normalizedColor.slice(2, 4), 16);
  const blue = Number.parseInt(normalizedColor.slice(4, 6), 16);

  return 0.299 * red + 0.587 * green + 0.114 * blue;
}

export function usesBackgroundLuminanceForZoneName(zone: Zone): boolean {
  return (
    zone.opacity < LOW_ZONE_OPACITY_THRESHOLD ||
    zone.shape === "circle" ||
    zone.shape === "hexagon"
  );
}

export function createDeterministicSamplePoints(
  polygon: LayoutPoint[],
  sampleCount: number
): LayoutPoint[] {
  const bounds = getPolygonBounds(polygon);
  const points: LayoutPoint[] = [];
  let seed = Math.round(bounds.x * 13 + bounds.y * 17 + bounds.width * 19);

  for (
    let attempts = 0;
    points.length < sampleCount && attempts < sampleCount * 20;
    attempts += 1
  ) {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    const xRatio = seed / 4294967296;
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    const yRatio = seed / 4294967296;
    const point = {
      x: bounds.x + bounds.width * xRatio,
      y: bounds.y + bounds.height * yRatio
    };

    if (isPointInPolygon(point, polygon)) {
      points.push(point);
    }
  }

  return points.length > 0
    ? points
    : [{ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }];
}

export function drawCanvasBackgroundImage(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement
) {
  const imageWidth = image.naturalWidth || image.width || CANVAS_WIDTH;
  const imageHeight = image.naturalHeight || image.height || CANVAS_HEIGHT;
  const scale = Math.max(CANVAS_WIDTH / imageWidth, CANVAS_HEIGHT / imageHeight);
  const renderedWidth = imageWidth * scale;
  const renderedHeight = imageHeight * scale;
  const x = (CANVAS_WIDTH - renderedWidth) / 2;
  const y = (CANVAS_HEIGHT - renderedHeight) / 2;

  context.drawImage(image, x, y, renderedWidth, renderedHeight);
}

export function getAverageCanvasLuminance(
  context: CanvasRenderingContext2D,
  points: LayoutPoint[]
): number {
  return (
    points.reduce((total, point) => {
      const pixel = context.getImageData(
        Math.max(0, Math.min(CANVAS_WIDTH - 1, Math.floor(point.x))),
        Math.max(0, Math.min(CANVAS_HEIGHT - 1, Math.floor(point.y))),
        1,
        1
      ).data;

      return total + 0.299 * pixel[0] + 0.587 * pixel[1] + 0.114 * pixel[2];
    }, 0) / points.length
  );
}

export function sampleZoneBackgroundLuminance(
  context: CanvasRenderingContext2D,
  zone: Zone
): number {
  return getAverageCanvasLuminance(
    context,
    createDeterministicSamplePoints(zone.polygon, BACKGROUND_SAMPLE_COUNT)
  );
}

export function createCanvasBackgroundSamplePoints(): LayoutPoint[] {
  const xPositions = [0.25, 0.5, 0.75].map(
    (ratio) => CANVAS_WIDTH * ratio
  );
  const yPositions = [CANVAS_HEIGHT - 60, CANVAS_HEIGHT - 24];

  return yPositions.flatMap((y) =>
    xPositions.map((x) => ({ x, y }))
  );
}

export function sampleCanvasBackgroundLuminance(
  context: CanvasRenderingContext2D
): number {
  return getAverageCanvasLuminance(
    context,
    createCanvasBackgroundSamplePoints()
  );
}

export function getFallbackCanvasLuminance(): number {
  return getHexLuminance(CANVAS_BACKGROUND_COLOR);
}
