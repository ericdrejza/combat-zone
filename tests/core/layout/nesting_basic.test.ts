import { describe, expect, it } from 'vitest';
import {
  footprintsOverlap,
  getFootprint,
  isFootprintInsideZone
} from '@core/layout/polygonGeometry';
import { packPolygonActors } from '@core/layout/nesting_ts';
import { actor, rectangle } from './nesting_test_helpers';

describe('polygon nesting layout', () => {
  it('centers a singular actor in the zone', () => {
    const result = packPolygonActors({
      actors: [actor('only')],
      polygon: rectangle(300, 200)
    });

    expect(result).toMatchObject({
      fits: true,
      borderSpacing: 16,
      placements: { only: { x: 150, y: 100 } }
    });
  });

  it('moves a singular actor from an invalid center to a valid polygon position', () => {
    const polygon = [
      { x: 0, y: 0 },
      { x: 320, y: 0 },
      { x: 320, y: 320 },
      { x: 200, y: 320 },
      { x: 200, y: 120 },
      { x: 0, y: 120 }
    ];
    const center = { x: 160, y: 160 };
    const result = packPolygonActors({
      actors: [actor('only')],
      polygon
    });

    expect(
      isFootprintInsideZone(
        getFootprint(actor('only'), center, 16, 16),
        polygon
      )
    ).toBe(false);
    expect(result.fits).toBe(true);
    expect(result.placements.only).not.toEqual(center);
    expect(
      isFootprintInsideZone(
        getFootprint(actor('only'), result.placements.only, 16, 16),
        polygon
      )
    ).toBe(true);
  });

  it('packs rectangle and circle footprints without overlap', () => {
    const result = packPolygonActors({
      actors: [actor('rectangle', 'rectangle'), actor('circle')],
      polygon: rectangle(300, 200)
    });
    const first = result.placements.rectangle;
    const second = result.placements.circle;

    expect(result.fits).toBe(true);
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(Math.hypot(first.x - second.x, first.y - second.y)).toBeGreaterThan(
      60 + 16
    );
  });

  it('balances FLEX actor spacing between neighboring actors and the zone boundary', () => {
    const result = packPolygonActors({
      actors: [actor('first'), actor('second')],
      polygon: rectangle(300, 200)
    });
    const first = result.placements.first;
    const second = result.placements.second;
    const actorBoundaryClearance = Math.min(
      first.x - 30,
      300 - first.x - 30,
      first.y - 30,
      200 - first.y - 30
    );
    const neighboringActorClearance =
      Math.hypot(first.x - second.x, first.y - second.y) - 60;

    expect(result.fits).toBe(true);
    expect(first).toEqual({ x: 210, y: 100 });
    expect(second).toEqual({ x: 90, y: 100 });
    expect(
      Math.abs(actorBoundaryClearance - neighboringActorClearance)
    ).toBeLessThanOrEqual(1);
  });

  it.each([
    [160, 12],
    [152, 8],
    [144, 4]
  ])('falls back to %ipx border spacing when needed', (width, spacing) => {
    const result = packPolygonActors({
      actors: [actor('first'), actor('second')],
      polygon: rectangle(width, 100)
    });

    expect(result.fits).toBe(true);
    expect(result.borderSpacing).toBe(spacing);
  });

  it('reduces border spacing incrementally for sequential layouts', () => {
    const result = packPolygonActors({
      actors: [actor('first'), actor('second')],
      layoutStrategy: 'SEQUENTIAL',
      polygon: rectangle(240, 100)
    });

    expect(result.fits).toBe(true);
    expect(result.borderSpacing).toBe(16);
  });

  it('keeps differently sized sequential actors aligned on shared rows', () => {
    const actors = [
      actor('small-first', 'circle', 20),
      actor('large-first-row', 'rectangle', 50),
      actor('small-second-row', 'circle', 20),
      actor('small-second-row-end', 'circle', 20)
    ];
    const polygon = rectangle(240, 260);
    const result = packPolygonActors({
      actors,
      layoutStrategy: 'SEQUENTIAL',
      polygon
    });

    expect(result.fits).toBe(true);
    expect(result.placements['small-first'].y).toBe(
      result.placements['large-first-row'].y
    );
    expect(result.placements['small-second-row'].y).toBe(
      result.placements['small-second-row-end'].y
    );
    expect(result.placements['small-second-row'].y).toBeGreaterThan(
      result.placements['small-first'].y
    );

    for (const current of actors) {
      expect(
        isFootprintInsideZone(
          getFootprint(current, result.placements[current.id], result.borderSpacing, 16),
          polygon
        )
      ).toBe(true);

      for (const other of actors) {
        if (current.id >= other.id) {
          continue;
        }

        expect(
          footprintsOverlap(
            getFootprint(current, result.placements[current.id], 8, 16),
            getFootprint(other, result.placements[other.id], 8, 16)
          )
        ).toBe(false);
      }
    }
  });

  it('rejects a layout that cannot fit without overlap', () => {
    const result = packPolygonActors({
      actors: [actor('first'), actor('second')],
      polygon: rectangle(100, 100)
    });

    expect(result).toMatchObject({
      fits: false,
      reason: 'no-space'
    });
  });

  it('keeps the incoming drop point alongside its packed target', () => {
    const dropPoint = { x: 250, y: 100 };
    const result = packPolygonActors({
      actors: [actor('existing'), actor('incoming')],
      incomingActorId: 'incoming',
      incomingDropPoint: dropPoint,
      polygon: rectangle(300, 200)
    });

    expect(result.fits).toBe(true);
    expect(result.incomingDropPoint).toEqual(dropPoint);
    expect(result.incomingTargetPoint).toEqual(result.placements.incoming);
  });

  it('is deterministic for a stable actor order', () => {
    const input = {
      actors: [actor('first'), actor('second'), actor('third')],
      polygon: rectangle(400, 300)
    };

    expect(packPolygonActors(input)).toEqual(packPolygonActors(input));
  });
});
