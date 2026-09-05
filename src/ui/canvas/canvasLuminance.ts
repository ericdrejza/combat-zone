import type { LayoutPoint } from '@core/layout/types';
import type { CanvasSize } from '@core/layout/polygonCanvasBounds';
import { DEFAULT_CANVAS_SIZE } from '@core/layout/polygonCanvasBounds';
import type { ImageAssetSource } from '@core/assets/imageAssetSource';
import type { Zone } from '@entities/zone/types';
import {
  BACKGROUND_SAMPLE_COUNT,
  CANVAS_BACKGROUND_COLOR,
  LOW_ZONE_OPACITY_THRESHOLD
} from './canvasConstants';
import { getPolygonBounds, isPointInPolygon } from './zones/zoneGeometry';

export function getReadableTextColor(backgroundColor: string): string {
  return getTextColorForLuminance(getHexLuminance(backgroundColor));
}

export function getTextColorForLuminance(luminance: number): string {
  return luminance > 128 ? '#111827' : '#ffffff';
}

export function getHexLuminance(backgroundColor: string): number {
  const normalizedColor = backgroundColor.replace('#', '');
  const red = Number.parseInt(normalizedColor.slice(0, 2), 16);
  const green = Number.parseInt(normalizedColor.slice(2, 4), 16);
  const blue = Number.parseInt(normalizedColor.slice(4, 6), 16);

  return 0.299 * red + 0.587 * green + 0.114 * blue;
}

export function usesBackgroundLuminanceForZoneName(zone: Zone): boolean {
  return (
    zone.opacity < LOW_ZONE_OPACITY_THRESHOLD ||
    zone.shape === 'circle' ||
    zone.shape === 'hexagon'
  );
}

/**
 * Keeps labels associated with a zone readable against the same visual
 * background used by the zone name itself.
 */
export function getZoneNameTextColor(
  zone: Zone,
  backgroundLuminance?: number
): string {
  return usesBackgroundLuminanceForZoneName(zone)
    ? getTextColorForLuminance(
        backgroundLuminance ?? getFallbackCanvasLuminance()
      )
    : getReadableTextColor(zone.colorFill);
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
  image: HTMLImageElement,
  canvasSize: CanvasSize = DEFAULT_CANVAS_SIZE
) {
  context.drawImage(image, 0, 0, canvasSize.width, canvasSize.height);
}

export function getAverageCanvasLuminance(
  context: CanvasRenderingContext2D,
  points: LayoutPoint[],
  canvasSize: CanvasSize = DEFAULT_CANVAS_SIZE
): number {
  return (
    points.reduce((total, point) => {
      const pixel = context.getImageData(
        Math.max(0, Math.min(canvasSize.width - 1, Math.floor(point.x))),
        Math.max(0, Math.min(canvasSize.height - 1, Math.floor(point.y))),
        1,
        1
      ).data;

      return total + 0.299 * pixel[0] + 0.587 * pixel[1] + 0.114 * pixel[2];
    }, 0) / points.length
  );
}

export function sampleZoneBackgroundLuminance(
  context: CanvasRenderingContext2D,
  zone: Zone,
  canvasSize: CanvasSize = DEFAULT_CANVAS_SIZE
): number {
  return getAverageCanvasLuminance(
    context,
    createDeterministicSamplePoints(zone.polygon, BACKGROUND_SAMPLE_COUNT),
    canvasSize
  );
}

export function createCanvasBackgroundSamplePoints(
  canvasSize: CanvasSize = DEFAULT_CANVAS_SIZE
): LayoutPoint[] {
  // The zoneless panel is centered over the canvas. Keep the sample window
  // inside that footprint so bright edges of a background do not outweigh
  // the pixels immediately behind the panel.
  const xPositions = [0.3, 0.5, 0.7].map(
    (ratio) => canvasSize.width * ratio
  );
  // The collapsed panel is anchored 12px from the bottom and is 48px tall;
  // sample its visual center instead of mixing in pixels above or below it.
  const yPositions = [canvasSize.height - 36];

  return yPositions.flatMap((y) => xPositions.map((x) => ({ x, y })));
}

export function sampleCanvasBackgroundLuminance(
  context: CanvasRenderingContext2D,
  canvasSize: CanvasSize = DEFAULT_CANVAS_SIZE
): number {
  return getAverageCanvasLuminance(
    context,
    createCanvasBackgroundSamplePoints(canvasSize),
    canvasSize
  );
}

export function getFallbackCanvasLuminance(): number {
  return getHexLuminance(CANVAS_BACKGROUND_COLOR);
}

/**
 * Remote images can be displayed without granting the browser permission to
 * read their pixels. Treat that unreadable case as a dark canvas so the
 * luminance-derived panel ink remains visible over image-only backgrounds.
 */
export function getImageLuminanceFallback(
  source: ImageAssetSource | null | undefined
): number {
  return source?.kind === 'url' ? 0 : getFallbackCanvasLuminance();
}
