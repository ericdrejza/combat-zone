import { describe, expect, it, vi } from 'vitest';
import { actorSelectionSampleOffsets, actorSurfaceContrast, createActorSurfaceContrast } from '@ui/canvas/actors/actorSurfaceContrast';
import { actorSurfaceZones } from '@ui/canvas/actors/actorSurfaceZones';
import { CANVAS_BACKGROUND_COLORS } from '@ui/canvas/canvasConstants';
import { collection, createZone } from './actorLayerTestFixtures';

const point = { x: 200, y: 200 };

describe('actor surface contrast', () => {
  it('uses local image pixels instead of a canvas-wide sample', () => {
    const read = (position: { x: number }) => position.x < 200 ? '#000000' : '#ffffff';
    expect(actorSurfaceContrast({ x: 150, y: 200 }, collection([]), read)).toBe('#ffffff');
    expect(actorSurfaceContrast({ x: 250, y: 200 }, collection([]), read)).toBe('#000000');
  });

  it('follows the actual canvas color in each theme without an image or zone', () => {
    expect(actorSurfaceContrast(point, collection([]), () => CANVAS_BACKGROUND_COLORS.light)).toBe('#000000');
    expect(actorSurfaceContrast(point, collection([]), () => CANVAS_BACKGROUND_COLORS.dark)).toBe('#ffffff');
  });

  it('composites translucent zones over the image before choosing contrast', () => {
    const zone = { ...createZone(), colorFill: '#ffffff', opacity: 0.1 };
    expect(actorSurfaceContrast(point, collection([zone]), () => '#000000')).toBe('#ffffff');
    expect(actorSurfaceContrast(point, collection([{ ...zone, opacity: 0.9 }]), () => '#000000')).toBe('#000000');
  });

  it('uses an opaque zone surface regardless of the underlying image', () => {
    expect(actorSurfaceContrast(point, collection([createZone()]), () => '#ffffff')).toBe('#ffffff');
    expect(actorSurfaceContrast(point, collection([{ ...createZone(), colorFill: '#ffffff' }]), () => '#000000')).toBe('#000000');
  });

  it('accounts for overlapping zones in their render order', () => {
    const dark = createZone();
    const light = { ...dark, id: 'light', colorFill: '#ffffff' };
    expect(actorSurfaceContrast(point, collection([dark, light]), () => '#000000')).toBe('#000000');
    expect(actorSurfaceContrast(point, collection([light, dark]), () => '#000000')).toBe('#ffffff');
  });

  it('ignores zones that do not cover the sample, including after dragging away', () => {
    expect(actorSurfaceContrast({ x: 400, y: 200 }, collection([createZone()]), () => '#ffffff')).toBe('#000000');
  });

  it('reads the selection perimeter even when the token center has the opposite color', () => {
    const read = vi.fn((position: { x: number; y: number }) => Math.hypot(position.x, position.y) < 10 ? '#ffffff' : '#000000');
    expect(actorSurfaceContrast(actorSelectionSampleOffsets('circle', 35), collection([]), read)).toBe('#ffffff');
    expect(read).toHaveBeenCalledTimes(8);
    for (const [position] of read.mock.calls) expect(Math.hypot(position.x, position.y)).toBeCloseTo(35);
  });

  it('samples the projected selection perimeter in canvas coordinates', () => {
    const offsets = actorSelectionSampleOffsets('rectangle', 30, 0, 45);
    expect(offsets[0].x).toBeCloseTo(15);
    expect(offsets[0].y).toBeCloseTo(15);
    expect(offsets[1].x).toBeCloseTo(0);
    expect(offsets[1].y).toBeCloseTo(30);
  });

  it('samples label and selection positions independently and follows a dragged actor', () => {
    const read = (position: { y: number }) => position.y < 220 ? '#000000' : '#ffffff';
    const original = createActorSurfaceContrast(point, collection([]), read);
    expect(original({ x: 0, y: 0 })).toBe('#ffffff');
    expect(original({ x: 0, y: 40 })).toBe('#000000');
    const moved = createActorSurfaceContrast({ x: 200, y: 300 }, collection([]), read);
    expect(moved({ x: 0, y: 0 })).toBe('#000000');
  });

  it('uses live zone movement and opacity previews when resolving the visible surface', () => {
    const zone = createZone();
    const zones = collection([zone]);
    const moved = actorSurfaceZones(zones, value => value.polygon, {
      zoneId: zone.id, phase: 'dragging', hasMoved: true,
      start: { x: 0, y: 0 }, current: { x: 300, y: 0 }, originalPolygon: zone.polygon
    }, null);
    expect(actorSurfaceContrast(point, moved, () => '#ffffff')).toBe('#000000');
    expect(actorSurfaceContrast({ x: 500, y: 200 }, moved, () => '#ffffff')).toBe('#ffffff');
    const transparent = actorSurfaceZones(zones, value => value.polygon, null, { zoneId: zone.id, opacity: 0 });
    expect(actorSurfaceContrast(point, transparent, () => '#ffffff')).toBe('#000000');
    expect(zones.byId[zone.id].opacity).toBe(1);
  });
});
