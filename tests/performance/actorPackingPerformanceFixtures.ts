import { expect } from 'vitest';

import { createEncounterState } from '@core/encounter/createEncounterState';
import { toNestingActor } from '@core/layout/actorFootprints';
import {
  footprintsOverlap,
  getFootprint,
  getPolygonBounds,
  isFootprintInsideZone
} from '@core/layout/polygonGeometry';
import type { PolygonNestingResult } from '@core/layout/nesting_ts';
import type { EntityCollection } from '@core/state/entityCollection';
import type { Actor } from '@entities/actor/types';
import type { Zone } from '@entities/zone/types';

export const ACTOR_COUNT = 50;
export const ZONE_ID = 'performance-zone';
export const ROOMY_POLYGON = [
  { x: 20, y: 20 },
  { x: 940, y: 20 },
  { x: 940, y: 620 },
  { x: 20, y: 620 }
];
export const UNDERSIZED_POLYGON = [
  { x: 20, y: 20 },
  { x: 520, y: 20 },
  { x: 520, y: 370 },
  { x: 20, y: 370 }
];

type Timing = {
  medianMs: number;
  p95Ms: number;
  samples: number[];
};

function collection<TEntity extends { id: string }>(
  entities: TEntity[]
): EntityCollection<TEntity> {
  return {
    allIds: entities.map((entity) => entity.id),
    byId: Object.fromEntries(entities.map((entity) => [entity.id, entity]))
  };
}

export function createActors(count: number, zoneId = ZONE_ID): Actor[] {
  return Array.from({ length: count }, (_, index) => ({
    actorType: 'creature',
    currentZoneId: zoneId,
    id: `actor-${index}`,
    layoutGroup: index % 3 === 0 ? 'enemy' : index % 3 === 1 ? 'hero' : 'neutral',
    metadata: {},
    name: `Actor ${index}`,
    shape: index % 4 === 0 ? 'rectangle' : 'circle',
    size: 'medium',
    statusEffects: []
  }));
}

function createZone(polygon = ROOMY_POLYGON, autoResize = false): Zone {
  return {
    autoResize,
    colorBorder: '#9b876b',
    colorFill: '#ffffff',
    id: ZONE_ID,
    layoutOrientation: 'LEFT_RIGHT',
    layoutStrategy: 'FLEX',
    name: 'Performance Zone',
    namePosition: 'top-left',
    opacity: 0.7,
    polygon,
    shape: 'rectangle',
    showBorder: true,
    showName: false,
    tags: []
  };
}

export function createEncounter(
  actorCount: number,
  polygon = ROOMY_POLYGON,
  autoResize = false
) {
  return {
    ...createEncounterState({
      id: 'packing-performance',
      name: 'Packing Performance'
    }),
    actors: collection(createActors(actorCount)),
    zones: collection([createZone(polygon, autoResize)])
  };
}

function summarize(samples: number[]): Timing {
  const sorted = [...samples].sort((first, second) => first - second);

  return {
    medianMs: sorted[Math.floor(sorted.length / 2)],
    p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1],
    samples
  };
}

export function measure<TResult>(operation: () => TResult): {
  result: TResult;
  timing: Timing;
} {
  for (let warmup = 0; warmup < 3; warmup += 1) {
    operation();
  }

  let result = operation();
  const samples = Array.from({ length: 10 }, () => {
    const start = process.hrtime.bigint();
    result = operation();

    return Number(process.hrtime.bigint() - start) / 1_000_000;
  });

  return { result, timing: summarize(samples) };
}

export function expectUnderTarget(label: string, timing: Timing): void {
  process.stdout.write(
    `[performance] ${label}: median=${timing.medianMs.toFixed(3)}ms ` +
      `p95=${timing.p95Ms.toFixed(3)}ms samples=${timing.samples.length}\n`
  );
  expect(timing.medianMs, `${label} median`).toBeLessThan(100);
  expect(timing.p95Ms, `${label} p95`).toBeLessThan(150);
}

export function expectValidSpread(
  actors: Actor[],
  packed: PolygonNestingResult,
  polygon = ROOMY_POLYGON
): void {
  expect(packed.fits).toBe(true);
  const nestingActors = actors.map(toNestingActor);
  const collisionFootprints = nestingActors.map((actor) =>
    getFootprint(actor, packed.placements[actor.id], 8, 16)
  );

  nestingActors.forEach((actor) => {
    expect(
      isFootprintInsideZone(
        getFootprint(
          actor,
          packed.placements[actor.id],
          packed.borderSpacing,
          16
        ),
        polygon
      )
    ).toBe(true);
  });

  collisionFootprints.forEach((footprint, index) => {
    for (
      let otherIndex = index + 1;
      otherIndex < collisionFootprints.length;
      otherIndex += 1
    ) {
      expect(footprintsOverlap(footprint, collisionFootprints[otherIndex])).toBe(
        false
      );
    }
  });

  const points = Object.values(packed.placements);
  const bounds = getPolygonBounds(polygon);
  const center = {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2
  };
  const centroid = points.reduce(
    (total, point) => ({
      x: total.x + point.x / points.length,
      y: total.y + point.y / points.length
    }),
    { x: 0, y: 0 }
  );
  const occupiedWidth =
    Math.max(...points.map((point) => point.x)) -
    Math.min(...points.map((point) => point.x));
  const occupiedHeight =
    Math.max(...points.map((point) => point.y)) -
    Math.min(...points.map((point) => point.y));
  const quadrantCounts = [0, 0, 0, 0];

  points.forEach((point) => {
    const quadrant =
      (point.y >= center.y ? 2 : 0) + (point.x >= center.x ? 1 : 0);
    quadrantCounts[quadrant] += 1;
  });

  expect(Math.abs(centroid.x - center.x)).toBeLessThan(
    (bounds.maxX - bounds.minX) * 0.08
  );
  expect(Math.abs(centroid.y - center.y)).toBeLessThan(
    (bounds.maxY - bounds.minY) * 0.08
  );
  expect(occupiedWidth).toBeGreaterThan((bounds.maxX - bounds.minX) * 0.6);
  expect(occupiedHeight).toBeGreaterThan((bounds.maxY - bounds.minY) * 0.6);
  expect(Math.min(...quadrantCounts)).toBeGreaterThanOrEqual(8);
}
