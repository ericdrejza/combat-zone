import type { LayoutPoint } from '@core/layout/types';
import type { EncounterState } from '@core/encounter/types';
import type { ActorShape } from '@entities/actor/types';
import { rotatePoint } from '@entities/zone/zoneRotation';
import { projectGridPoint } from '@core/movement/gridProjection';
import { getHexLuminance, getTextColorForLuminance } from '@ui/canvas/canvasLuminance';
import { isPointInPolygon } from '@ui/canvas/zones/zoneGeometry';

export type BackgroundPixelReader = (point: LayoutPoint) => string;
export type ActorSurfaceContrast = (offset: LayoutPoint | LayoutPoint[]) => string;

/** Bind canvas sampling to the token's current rendered position, including drag previews. */
export function createActorSurfaceContrast(point: LayoutPoint, zones: EncounterState['zones'], readBackground: BackgroundPixelReader): ActorSurfaceContrast {
  return offsets => actorSurfaceContrast(
    (Array.isArray(offsets) ? offsets : [offsets]).map(offset => ({ x: point.x + offset.x, y: point.y + offset.y })),
    zones,
    readBackground
  );
}

/** Composite in SVG paint order and sRGB before calculating relative luminance. */
export function actorSurfaceContrast(
  points: LayoutPoint | LayoutPoint[],
  zones: EncounterState['zones'],
  readBackground: BackgroundPixelReader
): string {
  const samples = Array.isArray(points) ? points : [points];
  return getTextColorForLuminance(samples.reduce((total, point) => total + surfaceLuminance(point, zones, readBackground), 0) / samples.length);
}

function surfaceLuminance(point: LayoutPoint, zones: EncounterState['zones'], readBackground: BackgroundPixelReader): number {
  const channels = (color: string) => [1, 3, 5].map(start => Number.parseInt(color.slice(start, start + 2), 16));
  let pixel = channels(readBackground(point));
  for (const id of zones.allIds) {
    const zone = zones.byId[id];
    if (!zone || !isPointInPolygon(point, zone.polygon)) continue;
    const fill = channels(zone.colorFill);
    pixel = pixel.map((value, index) => fill[index] * zone.opacity + value * (1 - zone.opacity));
  }
  return getHexLuminance('#' + pixel.map(value => Math.round(value).toString(16).padStart(2, '0')).join(''));
}

/** Sample the selection perimeter rather than the image underneath the token's center. */
export function actorSelectionSampleOffsets(shape: ActorShape, radius: number, rotation?: number, angle?: number): LayoutPoint[] {
  return Array.from({ length: 8 }, (_, index) => {
    const radians = index * Math.PI / 4;
    const x = Math.cos(radians), y = Math.sin(radians);
    const scale = shape === 'circle' ? radius : radius / Math.max(Math.abs(x), Math.abs(y));
    const point = { x: x * scale, y: y * scale };
    return rotation === undefined ? point : rotatePoint(projectGridPoint({ type: 'isometric', isometricAngle: angle }, point), rotation);
  });
}
