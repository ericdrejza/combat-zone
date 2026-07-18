import type { EncounterState } from '@core/encounter/types';
import type { LayoutComputationStrategy } from '@core/layout/types';
import type { PolygonNestingSettings } from '@core/layout/nesting_ts';
import type { Actor } from '@entities/actor/types';
import type { Zone } from '@entities/zone/types';
import { calculateActorPlacementGeometry } from './actorPlacementGeometryCalculator';
import {
  cacheActorPlacementGeometry,
  createActorPlacementCacheKey,
  getCachedActorPlacementGeometry,
  getLatestActorPlacementGeometry
} from './actorPlacementCache';
import {
  getPlanKey,
  getZonePlanKey,
  PROACTIVE_ACTOR_ID
} from './proactiveActorPlacementKeys';
import type { ActorPlacementGeometry } from './actorPlacementCache';
import { FLEX_ZONE_EDGE_GAP } from './actorFlexLayout';
import type {
  ActorPlacementWorkerRequest,
  ActorPlacementWorkerResponse
} from './actorPlacementWorkerTypes';

const MAX_PROACTIVE_PLANS = 128;
const proactivePlans = new Map<string, ActorPlacementGeometry[]>();
const listeners = new Set<() => void>();
const pendingRequests = new Set<string>();
let worker: Worker | undefined;
let nextRequestId = 1;
let latestRequestId = 0;
let proactiveAcceleration: 'WEBGPU' | 'CPU' = 'CPU';

function notifyListeners(): void {
  listeners.forEach((listener) => listener());
}

function setProactivePlan(
  key: string,
  geometry: ActorPlacementGeometry[]
): void {
  proactivePlans.delete(key);

  while (proactivePlans.size >= MAX_PROACTIVE_PLANS) {
    const oldestKey = proactivePlans.keys().next().value;

    if (!oldestKey) {
      break;
    }

    proactivePlans.delete(oldestKey);
  }

  proactivePlans.set(key, geometry);
}

function handleWorkerResponse(response: ActorPlacementWorkerResponse): void {
  // A fast state change can queue multiple snapshots. Older snapshots must not
  // replace the latest geometry or wake the canvas with stale placements.
  if (response.requestId < latestRequestId) {
    pendingRequests.delete(response.cacheKey);
    return;
  }

  if (response.phase === 'geometry') {
    pendingRequests.delete(response.cacheKey);
    cacheActorPlacementGeometry(response.cacheKey, response.geometry);
    notifyListeners();
    return;
  }

  proactiveAcceleration = response.proactiveAcceleration ?? 'CPU';

  Object.entries(response.proactivePlans).forEach(([key, geometry]) => {
    setProactivePlan(key, geometry);
  });

  notifyListeners();
}

function getWorker(): Worker | undefined {
  if (worker || typeof Worker === 'undefined') {
    return worker;
  }

  worker = new Worker(new URL('./actorPlacement.worker.ts', import.meta.url), {
    type: 'module'
  });
  worker.addEventListener(
    'message',
    (event: MessageEvent<ActorPlacementWorkerResponse>) => {
      if (event.data.type === 'calculated') {
        handleWorkerResponse(event.data);
      }
    }
  );

  return worker;
}

export function hasActorPlacementWorker(): boolean {
  return typeof Worker !== 'undefined';
}

/** Subscribes the canvas so it can render when an off-thread result arrives. */
export function subscribeToActorPlacementWorker(
  listener: () => void
): () => void {
  listeners.add(listener);

  return () => listeners.delete(listener);
}

export function requestActorPlacementComputation(
  encounter: EncounterState,
  nestingSettings: PolygonNestingSettings,
  options: {
    authoritativeZoneIds?: readonly string[];
    computationStrategy?: LayoutComputationStrategy;
    forceProactive?: boolean;
    knownGeometry?: ActorPlacementGeometry[];
  } = {}
): void {
  const computationStrategy = options.computationStrategy ?? 'LAZY';
  const authoritativeZoneIds = [
    ...(options.authoritativeZoneIds ?? encounter.zones.allIds)
  ];
  const cacheKey = createActorPlacementCacheKey(
    encounter,
    nestingSettings,
    FLEX_ZONE_EDGE_GAP
  );

  if (pendingRequests.has(cacheKey)) {
    return;
  }

  if (getCachedActorPlacementGeometry(cacheKey) && !options.forceProactive) {
    return;
  }

  if (worker && pendingRequests.size > 0) {
    // A crowded snapshot can still be inside a synchronous pack operation.
    // Terminating that worker lets the newest drop start immediately instead
    // of waiting behind a result that is already obsolete.
    worker.terminate();
    worker = undefined;
    pendingRequests.clear();
  }

  const placementWorker = getWorker();

  if (!placementWorker) {
    // Vitest's jsdom environment has no Worker implementation. Production
    // builds always take the worker branch; this keeps pure layout tests useful.
    const fallbackGeometry = [
      ...(options.knownGeometry ?? []),
      ...calculateActorPlacementGeometry(encounter, authoritativeZoneIds)
    ];
    cacheActorPlacementGeometry(cacheKey, fallbackGeometry);
    notifyListeners();
    return;
  }

  const request: ActorPlacementWorkerRequest = {
    encounter,
    authoritativeZoneIds: [...authoritativeZoneIds],
    computationStrategy,
    knownGeometry: options.knownGeometry ?? [],
    nestingSettings,
    requestId: nextRequestId,
    type: 'calculate'
  };
  nextRequestId += 1;
  latestRequestId = request.requestId;
  pendingRequests.add(cacheKey);
  placementWorker.postMessage(request);
}

export function getLastActorPlacementGeometry(
  _encounter: EncounterState
): ActorPlacementGeometry[] | undefined {
  return getLatestActorPlacementGeometry();
}

export function getWorkerProactiveActorPlacementGeometry(
  zone: Zone,
  actors: Actor[],
  nestingSettings: PolygonNestingSettings
): ActorPlacementGeometry[] | undefined {
  if (zone.layoutStrategy !== 'FLEX' && zone.layoutStrategy !== 'SEQUENTIAL') {
    return undefined;
  }

  const geometry = proactivePlans.get(
    getZonePlanKey(zone, actors, nestingSettings, true)
  );

  if (!geometry) {
    return undefined;
  }

  proactivePlans.delete(getZonePlanKey(zone, actors, nestingSettings, true));
  proactivePlans.set(
    getZonePlanKey(zone, actors, nestingSettings, true),
    geometry
  );
  const incomingActor = actors[actors.length - 1];

  return geometry.map((placement) =>
    placement.actorId === PROACTIVE_ACTOR_ID
      ? { ...placement, actorId: incomingActor.id }
      : placement
  );
}

export function clearActorPlacementWorkerCache(): void {
  proactivePlans.clear();
  pendingRequests.clear();
  proactiveAcceleration = 'CPU';
  nextRequestId += 1;
  latestRequestId = nextRequestId;
  notifyListeners();
}

export function getActorPlacementWorkerPlanCount(): number {
  return proactivePlans.size;
}

/** Reports which worker-side candidate ranking path is active for diagnostics. */
export function getProactivePlacementAcceleration(): 'WEBGPU' | 'CPU' {
  return proactiveAcceleration;
}

export { getPlanKey };
