import type { EncounterState } from '@core/encounter/types';
import { POLYGON_LAYOUT_SETTINGS } from '@core/layout/polygonFlexLayout';
import { getActorRenderPlacements, type ActorRenderPlacement } from './actorCanvasLayout';
import { createActorPlacementCacheKey, getCachedActorPlacementGeometry } from './actorPlacementCache';
import { FLEX_ZONE_EDGE_GAP } from './actorFlexLayout';
import { requestActorPlacementComputation, subscribeToActorPlacementWorker } from './actorPlacementWorkerClient';

/** Resolve the exact source layout before deriving a subsequent geometry edit. */
export function resolveActorPlacements(encounter: EncounterState): ActorRenderPlacement[] | Promise<ActorRenderPlacement[]> {
  if (!encounter.movementRules.zoneLocked || encounter.movementRules.snapToGrid) return getActorRenderPlacements(encounter);
  const key = createActorPlacementCacheKey(encounter, POLYGON_LAYOUT_SETTINGS, FLEX_ZONE_EDGE_GAP);
  const read = (): ActorRenderPlacement[] | undefined => getCachedActorPlacementGeometry(key)?.flatMap(({ actorId, ...geometry }) => {
    const actor = encounter.actors.byId[actorId];
    return actor ? [{ actor, ...geometry }] : [];
  });
  const cached = read();
  if (cached) return cached;
  // Request before subscribing so the synchronous non-worker fallback stays synchronous.
  requestActorPlacementComputation(encounter, POLYGON_LAYOUT_SETTINGS);
  const immediate = read();
  if (immediate) return immediate;
  return new Promise(resolve => {
    const unsubscribe = subscribeToActorPlacementWorker(() => {
      const placements = read();
      if (placements) { unsubscribe(); resolve(placements); }
    });
  });
}
