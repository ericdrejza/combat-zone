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
    expect(getHexLuminance('#ffffff')).toBe(1);
    expect(getHexLuminance('#000000')).toBe(0);
    expect(getTextColorForLuminance(0.18)).toBe('#000000');
    expect(getTextColorForLuminance(0.17)).toBe('#ffffff');
    expect(getReadableTextColor('#ffffff')).toBe('#000000');
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

  it('meets AA normal-text contrast throughout the relative luminance range', () => {
    for (let step = 0; step <= 10000; step += 1) {
      const luminance = step / 10000;
      const color = getTextColorForLuminance(luminance);
      const contrast = color === '#000000'
        ? (luminance + 0.05) / 0.05
        : 1.05 / (luminance + 0.05);
      expect(contrast).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('linearizes sRGB before weighting channels, including saturated colors', () => {
    expect(getHexLuminance('#ff0000')).toBeCloseTo(0.2126, 4);
    expect(getHexLuminance('#00ff00')).toBeCloseTo(0.7152, 4);
    expect(getHexLuminance('#0000ff')).toBeCloseTo(0.0722, 4);
    expect(getHexLuminance('#808080')).toBeCloseTo(0.21586, 4);
    expect(getReadableTextColor('#ff0000')).toBe('#000000');
    expect(getReadableTextColor('#00ff00')).toBe('#000000');
    expect(getReadableTextColor('#0000ff')).toBe('#ffffff');
  });

  it('uses the same relative luminance for sampled pixels and solid fills', () => {
    const context = {
      getImageData: () => ({ data: [128, 128, 128, 255] })
    } as unknown as CanvasRenderingContext2D;

    expect(getAverageCanvasLuminance(context, [{ x: 10, y: 10 }]))
      .toBeCloseTo(0.21586, 4);
  });

  it('uses the active theme canvas color for an empty background', () => {
    const lightLuminance = getFallbackCanvasLuminance('light');
    const darkLuminance = getFallbackCanvasLuminance('dark');

    expect(getTextColorForLuminance(lightLuminance)).toBe('#000000');
    expect(getTextColorForLuminance(darkLuminance)).toBe('#ffffff');
    expect(getImageLuminanceFallback(null, 'dark')).toBe(darkLuminance);
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

    expect(getZoneNameTextColor(roundZone, 1)).toBe('#000000');
    expect(getZoneNameTextColor(roundZone, 0)).toBe('#ffffff');
    expect(getZoneNameTextColor(opaqueZone, 0)).toBe('#000000');
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
    ).toBe(0.5);
  });

  it('samples the canvas area behind the collapsed panel', () => {
    const points = createCanvasBackgroundSamplePoints();
    const context = {
      getImageData: (_x: number, y: number) => ({
        data: y >= 592 && y <= 616 ? [40, 40, 40] : [240, 240, 240]
      })
    } as unknown as CanvasRenderingContext2D;

    expect(points).toHaveLength(3);
    expect(sampleCanvasBackgroundLuminance(context)).toBeCloseTo(getHexLuminance('#282828'));
  });
});
