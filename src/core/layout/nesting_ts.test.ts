import { describe, expect, it } from 'vitest';
import type { LayoutPoint } from './types';
import {
  packPolygonActors,
  type NestingActor
} from './nesting_ts';

const rectangle = (width: number, height: number): LayoutPoint[] => [
  { x: 0, y: 0 },
  { x: width, y: 0 },
  { x: width, y: height },
  { x: 0, y: height }
];

const actor = (
  id: string,
  shape: NestingActor['shape'] = 'circle'
): NestingActor => ({
  id,
  radius: 30,
  shape
});

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
