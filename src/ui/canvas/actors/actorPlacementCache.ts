import {
  ZONELESS_ACTOR_ZONE_ID,
  type EncounterState
} from '@core/encounter/types';
import type { PolygonNestingSettings } from '@core/layout/nesting_ts';

export type ActorPlacementGeometry = {
  actorId: string;
  point: { x: number; y: number };
  radius: number;
};

const MAX_CACHE_ENTRIES = 12;
const placementCache = new Map<string, ActorPlacementGeometry[]>();
let latestPlacementGeometry: ActorPlacementGeometry[] | undefined;

function getZoneCacheValue(encounter: EncounterState, zoneId: string) {
  const zone = encounter.zones.byId[zoneId];

  return zone
    ? [
        zoneId,
        zone.shape,
        zone.layoutStrategy,
        zone.layoutOrientation,
        zone.polygon.map(({ x, y }) => [x, y])
      ]
    : [zoneId, null];
}

function getActorCacheValue(encounter: EncounterState, actorId: string) {
  const actor = encounter.actors.byId[actorId];

  return actor
    ? [
        actorId,
        actor.currentZoneId,
        actor.layoutGroup,
        actor.shape,
        actor.size
      ]
    : [actorId, null];
}

function getEngagementCacheValue(
  encounter: EncounterState,
  engagementId: string
) {
  const engagement = encounter.engagements.byId[engagementId];

  return engagement
    ? [engagementId, engagement.parentZoneId]
    : [engagementId, null];
}

function getPositionedActorIds(encounter: EncounterState): string[] {
  return encounter.actors.allIds.filter((actorId) => {
    const actor = encounter.actors.byId[actorId];

    return Boolean(
      actor &&
        actor.currentZoneId !== ZONELESS_ACTOR_ZONE_ID &&
        encounter.zones.byId[actor.currentZoneId]
    );
  });
}

/**
 * Keys only the state that can change an actor's rendered position. This lets
 * visual-only actor edits reuse the existing geometry while still rendering
 * the latest actor object.
 */
export function createActorPlacementCacheKey(
  encounter: EncounterState,
  nestingSettings: PolygonNestingSettings,
  flexZoneEdgeGap: number
): string {
  const positionedActorIds = getPositionedActorIds(encounter);
  const positionedZoneIdSet = new Set(
    positionedActorIds.map(
      (actorId) => encounter.actors.byId[actorId]!.currentZoneId
    )
  );
  const positionedZoneIds = encounter.zones.allIds.filter((zoneId) =>
    positionedZoneIdSet.has(zoneId)
  );

  return JSON.stringify([
    flexZoneEdgeGap,
    nestingSettings,
    positionedZoneIds.map((zoneId) =>
      getZoneCacheValue(encounter, zoneId)
    ),
    positionedActorIds.map((actorId) =>
      getActorCacheValue(encounter, actorId)
    ),
    encounter.engagements.allIds
      .filter((engagementId) => {
        const engagement = encounter.engagements.byId[engagementId];

        return Boolean(engagement && positionedZoneIdSet.has(engagement.parentZoneId));
      })
      .map((engagementId) => getEngagementCacheValue(encounter, engagementId))
  ]);
}

export function getCachedActorPlacementGeometry(
  key: string,
  calculate?: () => ActorPlacementGeometry[]
): ActorPlacementGeometry[] | undefined {
  const cached = placementCache.get(key);

  if (cached) {
    return cached;
  }

  if (!calculate) {
    return undefined;
  }

  const geometry = calculate();

  if (placementCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = placementCache.keys().next().value;

    if (oldestKey) {
      placementCache.delete(oldestKey);
    }
  }

  placementCache.set(key, geometry);
  latestPlacementGeometry = geometry;
  return geometry;
}

export function cacheActorPlacementGeometry(
  key: string,
  geometry: ActorPlacementGeometry[]
): void {
  if (placementCache.has(key)) {
    return;
  }

  if (placementCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = placementCache.keys().next().value;

    if (oldestKey) {
      placementCache.delete(oldestKey);
    }
  }

  placementCache.set(key, geometry);
  latestPlacementGeometry = geometry;
}

export function getLatestActorPlacementGeometry():
  | ActorPlacementGeometry[]
  | undefined {
  return latestPlacementGeometry;
}
