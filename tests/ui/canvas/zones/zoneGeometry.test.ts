import { describe, expect, it } from 'vitest';

import type { Zone } from '@entities/zone/types';
import {
  createCirclePolygon,
  createHexagonPolygon,
  createRectanglePolygon,
  doPolygonsOverlap,
  getBoxSelectionBounds,
  getPolygonBounds,
  getZoneResizeHandles,
  isPolygonWithinCanvas,
  resizeZonePolygon,
  sortZoneIdsByPosition
} from '@ui/canvas/zones/zoneGeometry';

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

describe('zone geometry', () => {
  it('creates rectangle, circle, and hexagon polygons with expected segment counts', () => {
    expect(
      createRectanglePolygon({ x: 10, y: 20 }, { x: 110, y: 120 })
    ).toEqual([
      { x: 10, y: 20 },
      { x: 110, y: 20 },
      { x: 110, y: 120 },
      { x: 10, y: 120 }
    ]);

    expect(createCirclePolygon({ x: 0, y: 0 }, { x: 100, y: 80 })).toHaveLength(
      60
    );
    expect(
      createHexagonPolygon({ x: 0, y: 0 }, { x: 100, y: 80 })
    ).toHaveLength(6);
  });

  it('resizes rectangle corners by moving connected vertices', () => {
    const zone = createZone();
    const resized = resizeZonePolygon(zone, zone.polygon, 1, { x: 140, y: 0 });

    expect(resized).toEqual([
      { x: 10, y: 0 },
      { x: 140, y: 0 },
      { x: 140, y: 110 },
      { x: 10, y: 110 }
    ]);
  });

  it('uses eight bounds handles while resizing generated hexagon geometry', () => {
    const hexagonPolygon = createHexagonPolygon(
      { x: 100, y: 100 },
      { x: 200, y: 180 }
    );
    const zone = createZone({
      polygon: hexagonPolygon,
      shape: 'hexagon'
    });

    expect(getZoneResizeHandles(zone, zone.polygon)).toHaveLength(8);

    const resized = resizeZonePolygon(zone, zone.polygon, 6, { x: 80, y: 140 });
    const bounds = getPolygonBounds(resized);

    expect(resized).toHaveLength(6);
    expect(bounds.x).toBe(80);
    expect(bounds.width).toBe(120);
  });

  it('detects canvas bounds, polygon overlap, and box selection bounds', () => {
    const first = createRectanglePolygon({ x: 10, y: 10 }, { x: 110, y: 110 });
    const second = createRectanglePolygon({ x: 90, y: 90 }, { x: 140, y: 140 });
    const third = createRectanglePolygon(
      { x: 200, y: 200 },
      { x: 260, y: 260 }
    );

    expect(isPolygonWithinCanvas(first)).toBe(true);
    expect(isPolygonWithinCanvas([{ x: -1, y: 0 }, ...first.slice(1)])).toBe(
      false
    );
    expect(doPolygonsOverlap(first, second)).toBe(true);
    expect(doPolygonsOverlap(first, third)).toBe(false);
    expect(
      getBoxSelectionBounds({
        current: { x: 40, y: 20 },
        start: { x: 10, y: 80 }
      })
    ).toEqual({
      height: 60,
      width: 30,
      x: 10,
      y: 20
    });
  });

  it('sorts zones by horizontal position then vertical position', () => {
    const topLeft = createZone({
      id: 'zone-top-left',
      polygon: createRectanglePolygon({ x: 10, y: 10 }, { x: 20, y: 20 })
    });
    const bottomLeft = createZone({
      id: 'zone-bottom-left',
      polygon: createRectanglePolygon({ x: 10, y: 30 }, { x: 20, y: 40 })
    });
    const right = createZone({
      id: 'zone-right',
      polygon: createRectanglePolygon({ x: 50, y: 0 }, { x: 60, y: 10 })
    });

    expect(
      sortZoneIdsByPosition({
        allIds: [right.id, bottomLeft.id, topLeft.id],
        byId: {
          [bottomLeft.id]: bottomLeft,
          [right.id]: right,
          [topLeft.id]: topLeft
        }
      })
    ).toEqual([topLeft.id, bottomLeft.id, right.id]);
  });
});
