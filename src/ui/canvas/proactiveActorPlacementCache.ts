import type { EncounterState } from '@core/encounter/types';
import type { LayoutComputationStrategy } from '@core/layout/types';
import type {
  NestingActor,
  PolygonNestingSettings
} from '@core/layout/nesting_ts';
import {
  ACTOR_TOKEN_BASE_RADIUS,
  getActorRadius
} from '@core/layout/actorFootprints';
import { ACTOR_SIZE_MULTIPLIERS } from '@entities/actor/actorVisuals';
import type { Actor, ActorShape, ActorSize } from '@entities/actor/types';
import type { Zone } from '@entities/zone/types';
import { createActorPlacementCacheKey } from './actorPlacementCache';
import type { ActorPlacementGeometry } from './actorPlacementCache';
import {
  clearActorPlacementWorkerCache,
  getActorPlacementWorkerPlanCount,
  getWorkerProactiveActorPlacementGeometry,
  hasActorPlacementWorker,
  requestActorPlacementComputation
} from './actorPlacementWorkerClient';
import {
  getPlanKey,
  getZonePlanKey,
  PROACTIVE_ACTOR_ID
} from './proactiveActorPlacementKeys';

export const DEFAULT_LAYOUT_COMPUTATION_STRATEGY: LayoutComputationStrategy =
  'PROACTIVE';

const PROACTIVE_ACTOR_SIZES: ActorSize[] = [
  'small',
  'medium',
  'large',
  'xLarge'
];
const PROACTIVE_ACTOR_SHAPES: ActorShape[] = ['circle', 'rectangle'];

export type ProactivePlacementCalculator = (
  zone: Zone,
  actors: NestingActor[]
) => ActorPlacementGeometry[] | undefined;

type ProactiveJob = {
  actors: Actor[];
  calculator: ProactivePlacementCalculator;
  incomingShape: ActorShape;
  incomingSize: ActorSize;
  nestingSettings: PolygonNestingSettings;
  zone: Zone;
};

const fallbackPlans = new Map<string, ActorPlacementGeometry[]>();
let scheduledStateKey: string | undefined;
let scheduledGeneration = 0;

function getZoneActors(encounter: EncounterState, zoneId: string): Actor[] {
  return encounter.actors.allIds.flatMap((actorId) => {
    const actor = encounter.actors.byId[actorId];

    return actor?.currentZoneId === zoneId ? [actor] : [];
  });
}

function toNestingActors(
  actors: Actor[],
  incomingSize?: ActorSize,
  incomingShape?: ActorShape
): NestingActor[] {
  const nestingActors = actors.map((actor) => ({
    id: actor.id,
    radius: getActorRadius(actor),
    shape: actor.shape
  }));

  if (incomingSize && incomingShape) {
    nestingActors.push({
      id: PROACTIVE_ACTOR_ID,
      radius: ACTOR_TOKEN_BASE_RADIUS * ACTOR_SIZE_MULTIPLIERS[incomingSize],
      shape: incomingShape
    });
  }

  return nestingActors;
}

function scheduleTask(task: () => void): void {
  globalThis.setTimeout(task, 0);
}

function runFallbackJobs(
  jobs: ProactiveJob[],
  generation: number,
  index = 0
): void {
  if (generation !== scheduledGeneration || index >= jobs.length) {
    return;
  }

  scheduleTask(() => {
    if (generation !== scheduledGeneration) {
      return;
    }

    const job = jobs[index];
    const geometry = job.calculator(
      job.zone,
      toNestingActors(job.actors, job.incomingSize, job.incomingShape)
    );

    if (geometry) {
      fallbackPlans.set(
        getPlanKey(
          job.zone,
          job.actors,
          job.nestingSettings,
          job.incomingSize,
          job.incomingShape
        ),
        geometry
      );
    }

    runFallbackJobs(jobs, generation, index + 1);
  });
}

export function getProactiveActorPlacementGeometry(
  zone: Zone,
  actors: Actor[],
  nestingSettings: PolygonNestingSettings
): ActorPlacementGeometry[] | undefined {
  if (hasActorPlacementWorker()) {
    return getWorkerProactiveActorPlacementGeometry(
      zone,
      actors,
      nestingSettings
    );
  }

  const geometry = fallbackPlans.get(
    getZonePlanKey(zone, actors, nestingSettings, true)
  );

  if (!geometry || actors.length === 0) {
    return undefined;
  }

  const incomingActor = actors[actors.length - 1];

  return geometry.map((placement) =>
    placement.actorId === PROACTIVE_ACTOR_ID
      ? { ...placement, actorId: incomingActor.id }
      : placement
  );
}

export function scheduleProactiveActorPlacementComputations(
  encounter: EncounterState,
  nestingSettings: PolygonNestingSettings,
  calculator: ProactivePlacementCalculator
): void {
  const stateKey = createActorPlacementCacheKey(encounter, nestingSettings, 0);

  if (stateKey === scheduledStateKey) {
    return;
  }

  scheduledStateKey = stateKey;
  scheduledGeneration += 1;

  if (hasActorPlacementWorker()) {
    requestActorPlacementComputation(encounter, nestingSettings, {
      authoritativeZoneIds: [],
      computationStrategy: 'PROACTIVE',
      forceProactive: true
    });
    return;
  }

  const jobs: ProactiveJob[] = [];

  for (const zoneId of encounter.zones.allIds) {
    const zone = encounter.zones.byId[zoneId];

    if (
      !zone ||
      (zone.layoutStrategy !== 'FLEX' && zone.layoutStrategy !== 'SEQUENTIAL')
    ) {
      continue;
    }

    const actors = getZoneActors(encounter, zoneId);

    for (const incomingSize of PROACTIVE_ACTOR_SIZES) {
      for (const incomingShape of PROACTIVE_ACTOR_SHAPES) {
        jobs.push({
          actors,
          calculator,
          incomingShape,
          incomingSize,
          nestingSettings,
          zone
        });
      }
    }
  }

  runFallbackJobs(jobs, scheduledGeneration);
}

export function clearProactiveActorPlacementCache(): void {
  fallbackPlans.clear();
  scheduledStateKey = undefined;
  scheduledGeneration += 1;
  clearActorPlacementWorkerCache();
}

export function getProactivePlanCount(): number {
  return hasActorPlacementWorker()
    ? getActorPlacementWorkerPlanCount()
    : fallbackPlans.size;
}

export type { ProactivePlacementCalculator as ProactivePlacementCalculatorType };
