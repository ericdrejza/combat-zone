import { describe, expect, it } from 'vitest';

import { createEncounterState } from '@core/encounter/createEncounterState';
import type { EntityCollection } from '@core/state/entityCollection';
import type { Actor } from '@entities/actor/types';
import type { Zone } from '@entities/zone/types';
import { POLYGON_LAYOUT_SETTINGS } from '@core/layout/polygonFlexLayout';
import {
  calculateActorPlacementGeometry
} from './actorPlacementGeometryCalculator';
import {
  clearProactiveActorPlacementCache,
  getProactiveActorPlacementGeometry,
  getProactivePlanCount,
  scheduleProactiveActorPlacementComputations
} from './proactiveActorPlacementCache';
import { calculateNonSplitZonePlacementGeometry } from './actorNonSplitLayout';

const BENCHMARK_ACTOR_COUNT = 12;
const BENCHMARK_ADDITIONS = 4;
const EXPECTED_PLANS_PER_STATE = 8;

function collection<TEntity extends { id: string }>(
  entities: TEntity[]
): EntityCollection<TEntity> {
  return {
    allIds: entities.map((entity) => entity.id),
    byId: Object.fromEntries(entities.map((entity) => [entity.id, entity]))
  };
}

function benchmarkActor(id: string, zoneId: string): Actor {
  return {
    actorType: 'creature',
    currentZoneId: zoneId,
    id,
    layoutGroup: 'hero',
    metadata: {},
    name: id,
    shape: 'circle',
    size: 'medium',
    statusEffects: []
  };
}

function benchmarkZone(id: string): Zone {
  return {
    colorBorder: '#9b876b',
    colorFill: '#ffffff',
    id,
    layoutOrientation: 'LEFT_RIGHT',
    layoutStrategy: 'FLEX',
    name: id,
    namePosition: 'top-left',
    opacity: 0.7,
    polygon: [
      { x: 0, y: 0 },
      { x: 1400, y: 0 },
      { x: 1400, y: 1000 },
      { x: 0, y: 1000 }
    ],
    shape: 'rectangle',
    showBorder: true,
    showName: false,
    tags: []
  };
}

function createBenchmarkEncounter(actorCount: number) {
  const zoneId = 'performance-zone';
  const actors = Array.from({ length: actorCount }, (_, index) =>
    benchmarkActor(`actor-${index}`, zoneId)
  );

  return {
    ...createEncounterState({ id: 'placement-performance', name: 'Performance' }),
    actors: collection(actors),
    zones: collection([benchmarkZone(zoneId)])
  };
}

function addBenchmarkActor(
  encounter: ReturnType<typeof createBenchmarkEncounter>
) {
  const actor = benchmarkActor(
    `actor-${encounter.actors.allIds.length}`,
    'performance-zone'
  );

  return {
    ...encounter,
    actors: {
      allIds: [...encounter.actors.allIds, actor.id],
      byId: { ...encounter.actors.byId, [actor.id]: actor }
    }
  };
}

function getZoneActors(
  encounter: ReturnType<typeof createBenchmarkEncounter>
): Actor[] {
  return encounter.actors.allIds.flatMap((actorId) => {
    const actor = encounter.actors.byId[actorId];

    return actor?.currentZoneId === 'performance-zone' ? [actor] : [];
  });
}

function median(values: number[]): number {
  const sorted = [...values].sort((first, second) => first - second);

  return sorted[Math.floor(sorted.length / 2)];
}

function measure(operation: () => void): number {
  // Warm up the JIT before measuring the operation that represents an actor
  // addition. The benchmark compares packing work with a plan lookup, not the
  // one-time module compilation cost.
  operation();
  const samples = Array.from({ length: 5 }, () => {
    const start = process.hrtime.bigint();
    operation();

    return Number(process.hrtime.bigint() - start) / 1_000_000;
  });

  return median(samples);
}

async function precomputePlans(
  encounter: ReturnType<typeof createBenchmarkEncounter>
): Promise<void> {
  // The application retains plans for older states. Clearing here makes the
  // benchmark wait for this exact state rather than mistaking old plans for a
  // completed calculation.
  clearProactiveActorPlacementCache();
  scheduleProactiveActorPlacementComputations(
    encounter,
    POLYGON_LAYOUT_SETTINGS,
    calculateNonSplitZonePlacementGeometry
  );

  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (getProactivePlanCount() >= EXPECTED_PLANS_PER_STATE) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 1));
  }

  throw new Error('Timed out waiting for proactive placement plans');
}

describe('actor placement performance', () => {
  it('compares lazy packing with a completed proactive plan at scale', async () => {
    clearProactiveActorPlacementCache();

    try {
      let encounter = createBenchmarkEncounter(BENCHMARK_ACTOR_COUNT);
      const lazySamples: number[] = [];
      const proactiveSamples: number[] = [];

      await precomputePlans(encounter);

      for (let index = 0; index < BENCHMARK_ADDITIONS; index += 1) {
        const nextEncounter = addBenchmarkActor(encounter);
        const lazyDuration = measure(() => {
          const geometry = calculateActorPlacementGeometry(nextEncounter);

          expect(geometry).toHaveLength(BENCHMARK_ACTOR_COUNT + index + 1);
        });
        const proactiveDuration = measure(() => {
          const geometry = getProactiveActorPlacementGeometry(
            nextEncounter.zones.byId['performance-zone']!,
            getZoneActors(nextEncounter),
            POLYGON_LAYOUT_SETTINGS
          );

          expect(geometry).toBeDefined();
          expect(geometry).toHaveLength(BENCHMARK_ACTOR_COUNT + index + 1);
        });

        lazySamples.push(lazyDuration);
        proactiveSamples.push(proactiveDuration);
        encounter = nextEncounter;

        if (index < BENCHMARK_ADDITIONS - 1) {
          await precomputePlans(encounter);
        }
      }

      const lazyMedian = median(lazySamples);
      const proactiveMedian = median(proactiveSamples);

      console.info('[actor-placement-performance]', {
        actors: BENCHMARK_ACTOR_COUNT,
        additions: BENCHMARK_ADDITIONS,
        lazyMedianMs: lazyMedian.toFixed(3),
        proactiveLookupMedianMs: proactiveMedian.toFixed(3),
        speedup: `${(lazyMedian / Math.max(proactiveMedian, 0.001)).toFixed(1)}x`
      });

      expect(proactiveMedian).toBeLessThan(lazyMedian);
    } finally {
      clearProactiveActorPlacementCache();
    }
  }, 30000);
});
