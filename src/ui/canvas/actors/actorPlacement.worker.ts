import { getActorRadius } from '@core/layout/actorFootprints';
import type { ActorSize, ActorShape } from '@entities/actor/types';
import { createActorPlacementCacheKey } from './actorPlacementCache';
import { calculateActorPlacementGeometry } from './actorPlacementGeometryCalculator';
import {
  calculateNonSplitZonePlacementGeometry,
  calculateNonSplitZonePlacementGeometryAsync
} from './actorNonSplitLayout';
import { createProactivePlacementGpuAccelerator } from './proactivePlacementGpu';
import type { NestingCandidateRanker } from '@core/layout/nestingPackingAsync';
import { getPlanKey, PROACTIVE_ACTOR_ID } from './proactiveActorPlacementKeys';
import type {
  ActorPlacementWorkerRequest,
  ActorPlacementWorkerResponse
} from './actorPlacementWorkerTypes';
import type { Actor } from '@entities/actor/types';
import type { ActorPlacementGeometry } from './actorPlacementCache';
import type { NestingActor } from '@core/layout/nesting_ts';
import { ACTOR_TOKEN_BASE_RADIUS } from '@core/layout/actorFootprints';
import { ACTOR_SIZE_MULTIPLIERS } from '@entities/actor/actorVisuals';
import { FLEX_ZONE_EDGE_GAP } from './actorFlexLayout';

const PROACTIVE_ACTOR_SIZES: ActorSize[] = [
  'small',
  'medium',
  'large',
  'xLarge'
];
const PROACTIVE_ACTOR_SHAPES: ActorShape[] = ['circle', 'rectangle'];

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

function getZoneActors(
  encounter: ActorPlacementWorkerRequest['encounter'],
  zoneId: string
): Actor[] {
  return encounter.actors.allIds.flatMap((actorId) => {
    const actor = encounter.actors.byId[actorId];

    return actor?.currentZoneId === zoneId ? [actor] : [];
  });
}

type ProactiveJob = {
  actors: Actor[];
  incomingShape: ActorShape;
  incomingSize: ActorSize;
  nestingSettings: ActorPlacementWorkerRequest['nestingSettings'];
  zone: NonNullable<
    ActorPlacementWorkerRequest['encounter']['zones']['byId'][string]
  >;
};

function getProactiveJobs(
  encounter: ActorPlacementWorkerRequest['encounter'],
  nestingSettings: ActorPlacementWorkerRequest['nestingSettings']
): ProactiveJob[] {
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
          incomingShape,
          incomingSize,
          nestingSettings,
          zone
        });
      }
    }
  }

  return jobs;
}

const workerScope = self as unknown as {
  addEventListener: (
    type: 'message',
    listener: (event: MessageEvent<ActorPlacementWorkerRequest>) => void
  ) => void;
  postMessage: (message: ActorPlacementWorkerResponse) => void;
};

let activeProactiveGeneration = 0;

async function runProactiveJobs(
  request: ActorPlacementWorkerRequest,
  cacheKey: string,
  jobs: ProactiveJob[],
  generation: number,
  plans: Record<string, ActorPlacementGeometry[]> = {},
  index = 0,
  rankCandidates?: NestingCandidateRanker
): Promise<void> {
  if (generation !== activeProactiveGeneration) {
    return Promise.resolve();
  }

  if (index >= jobs.length) {
    workerScope.postMessage({
      cacheKey,
      geometry: [],
      phase: 'proactive',
      proactiveAcceleration: rankCandidates ? 'WEBGPU' : 'CPU',
      proactivePlans: plans,
      requestId: request.requestId,
      type: 'calculated'
    });
    return;
  }

  const job = jobs[index];
  const nestingActors = toNestingActors(
    job.actors,
    job.incomingSize,
    job.incomingShape
  );
  let geometry: ActorPlacementGeometry[] | undefined;

  if (rankCandidates) {
    try {
      geometry = await calculateNonSplitZonePlacementGeometryAsync(
        job.zone,
        nestingActors,
        rankCandidates
      );
    } catch {
      rankCandidates = undefined;
    }
  }

  geometry ??= calculateNonSplitZonePlacementGeometry(job.zone, nestingActors);

  if (geometry) {
    plans[
      getPlanKey(
        job.zone,
        job.actors,
        job.nestingSettings,
        job.incomingSize,
        job.incomingShape
      )
    ] = geometry;
  }

  setTimeout(
    () =>
      runProactiveJobs(
        request,
        cacheKey,
        jobs,
        generation,
        plans,
        index + 1,
        rankCandidates
      ),
    0
  );
}

workerScope.addEventListener('message', (event) => {
  const request = event.data;

  if (request.type !== 'calculate') {
    return;
  }

  const cacheKey = createActorPlacementCacheKey(
    request.encounter,
    request.nestingSettings,
    FLEX_ZONE_EDGE_GAP
  );
  const response: ActorPlacementWorkerResponse = {
    cacheKey,
    geometry: [
      ...request.knownGeometry,
      ...calculateActorPlacementGeometry(
        request.encounter,
        request.authoritativeZoneIds
      )
    ],
    phase: 'geometry',
    proactiveAcceleration: 'CPU',
    proactivePlans: {},
    requestId: request.requestId,
    type: 'calculated'
  };

  activeProactiveGeneration += 1;
  workerScope.postMessage(response);

  if (request.computationStrategy !== 'PROACTIVE') {
    return;
  }

  const generation = activeProactiveGeneration;
  const jobs = getProactiveJobs(request.encounter, request.nestingSettings);

  setTimeout(() => {
    void createProactivePlacementGpuAccelerator()
      .catch(() => undefined)
      .then((accelerator) =>
        runProactiveJobs(
          request,
          cacheKey,
          jobs,
          generation,
          {},
          0,
          accelerator?.rankCandidates
        )
      );
  }, 0);
});
