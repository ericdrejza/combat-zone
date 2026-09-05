import { describe, expect, it } from 'vitest';

import type { Zone } from '@entities/zone/types';
import {
  createDeterministicSamplePoints,
  createCanvasBackgroundSamplePoints,
  getAverageCanvasLuminance,
  getFallbackCanvasLuminance,
  getHexLuminance,
  getImageLuminanceFallback,
  getReadableTextColor,
  getTextColorForLuminance,
  getZoneNameTextColor,
  sampleCanvasBackgroundLuminance,
  usesBackgroundLuminanceForZoneName
} from '@ui/canvas/canvasLuminance';

function createZone(overrides: Partial<Zone> = {}): Zone {
  return {
    colorBorder: '#9b876b',
    colorFill: '#ffffff',
    id: 'zone-test',
    layoutOrientation: 'LEFT_RIGHT',
    layoutStrategy: 'FLEX',
    name: 'Test Zone',
    namePosition: 'top-left',
    opacity: 0.7,
    polygon: [
      { x: 10, y: 10 },
      { x: 110, y: 10 },
      { x: 110, y: 110 },
      { x: 10, y: 110 }
    ],
    shape: 'rectangle',
    showBorder: true,
    showName: false,
    tags: [],
    ...overrides
  };
}

describe('canvas luminance', () => {
  it('calculates readable text color from hex luminance', () => {
    expect(getHexLuminance('#ffffff')).toBe(255);
    expect(getHexLuminance('#000000')).toBe(0);
    expect(getTextColorForLuminance(129)).toBe('#111827');
    expect(getTextColorForLuminance(128)).toBe('#ffffff');
    expect(getReadableTextColor('#ffffff')).toBe('#111827');
    expect(getReadableTextColor('#000000')).toBe('#ffffff');
  });

  it('uses light contrast ink when an external image cannot expose pixels', () => {
    expect(
      getTextColorForLuminance(
        getImageLuminanceFallback({
          kind: 'url',
          url: 'https://img.magnific.com/background.jpg'
        })
      )
    ).toBe('#ffffff');
    expect(getImageLuminanceFallback(null)).toBe(
      getFallbackCanvasLuminance()
    );
  });

  it('samples deterministic points inside a polygon', () => {
    const polygon = createZone().polygon;
    const firstRun = createDeterministicSamplePoints(polygon, 5);
    const secondRun = createDeterministicSamplePoints(polygon, 5);

    expect(firstRun).toHaveLength(5);
    expect(firstRun).toEqual(secondRun);
    firstRun.forEach((point) => {
      expect(point.x).toBeGreaterThanOrEqual(10);
      expect(point.x).toBeLessThanOrEqual(110);
      expect(point.y).toBeGreaterThanOrEqual(10);
      expect(point.y).toBeLessThanOrEqual(110);
    });
  });

  it('chooses background luminance for transparent and generated round zones', () => {
    expect(
      usesBackgroundLuminanceForZoneName(createZone({ opacity: 0.29 }))
    ).toBe(true);
    expect(
      usesBackgroundLuminanceForZoneName(
        createZone({
          opacity: 1,
          shape: 'circle'
        })
      )
    ).toBe(true);
    expect(
      usesBackgroundLuminanceForZoneName(
        createZone({
          opacity: 1,
          shape: 'hexagon'
        })
      )
    ).toBe(true);
    expect(
      usesBackgroundLuminanceForZoneName(createZone({ opacity: 0.3 }))
    ).toBe(false);
  });

  it('uses the same contrast source for actor labels as their zone names', () => {
    const roundZone = createZone({
      colorFill: '#000000',
      shape: 'circle'
    });
    const opaqueZone = createZone({ colorFill: '#ffffff' });

    expect(getZoneNameTextColor(roundZone, 255)).toBe('#111827');
    expect(getZoneNameTextColor(roundZone, 0)).toBe('#ffffff');
    expect(getZoneNameTextColor(opaqueZone, 0)).toBe('#111827');
  });

  it('averages canvas pixel luminance across sample points', () => {
    const context = {
      getImageData: (x: number) => ({
        data: x < 50 ? [255, 255, 255] : [0, 0, 0]
      })
    } as unknown as CanvasRenderingContext2D;

    expect(
      getAverageCanvasLuminance(context, [
        { x: 10, y: 10 },
        { x: 90, y: 10 }
      ])
    ).toBe(127.5);
  });

  it('samples the canvas area behind the collapsed panel', () => {
    const points = createCanvasBackgroundSamplePoints();
    const context = {
      getImageData: (_x: number, y: number) => ({
        data: y >= 592 && y <= 616 ? [40, 40, 40] : [240, 240, 240]
      })
    } as unknown as CanvasRenderingContext2D;

    expect(points).toHaveLength(3);
    expect(sampleCanvasBackgroundLuminance(context)).toBe(40);
  });
});
