import type { Actor } from '@entities/actor/types';
import type { EncounterState } from '@core/encounter/types';
import type {
  LayoutComputationStrategy,
  LayoutPoint
} from '@core/layout/types';
import {
  ACTOR_TOKEN_BASE_RADIUS,
  FLEX_ZONE_EDGE_GAP
} from './actorPlacementGeometryCalculator';
import { getActorRadius } from '@core/layout/actorFootprints';
import {
  createActorPlacementCacheKey,
  getCachedActorPlacementGeometry
} from './actorPlacementCache';
import type { ActorPlacementGeometry } from './actorPlacementCache';
import {
  getProactiveActorPlacementGeometry,
  DEFAULT_LAYOUT_COMPUTATION_STRATEGY
} from './proactiveActorPlacementCache';
import {
  hasActorPlacementWorker,
  requestActorPlacementComputation,
  getLastActorPlacementGeometry
} from './actorPlacementWorkerClient';
import { POLYGON_LAYOUT_SETTINGS } from '@core/layout/polygonFlexLayout';
import { ZONELESS_ACTOR_ZONE_ID } from '@core/encounter/types';
import {
  clearOptimisticActorPlacement,
  getOptimisticActorPlacement
} from './actorPlacementOptimisticState';

export type { ActorPlacementGeometry } from './actorPlacementCache';

/*
 * Keep the computation policy separate from FLEX/SEQUENTIAL. Proactive plans
 * remain limited to non-split polygon packing as defined by the feature scope.
 */
export const ACTOR_LAYOUT_COMPUTATION_STRATEGY: LayoutComputationStrategy =
  DEFAULT_LAYOUT_COMPUTATION_STRATEGY;

export { findZoneIdAtPoint } from '../zones/zoneHitTesting';

export { ACTOR_TOKEN_BASE_RADIUS, FLEX_ZONE_EDGE_GAP };

export type ActorRenderPlacement = {
  actor: Actor;
  /** Accepted derived token point shared by rendering and hit-testing. */
  engagementTokenPoint?: LayoutPoint;
  /** Transient drop location used as the start of the placement animation. */
  incomingPoint?: LayoutPoint;
  point: LayoutPoint;
  radius: number;
  /** Split-layout section used by engagement token geometry. */
  sectionPolygon?: LayoutPoint[];
};

export function getActorRenderPlacements(
  encounter: EncounterState,
  computationStrategy: LayoutComputationStrategy = ACTOR_LAYOUT_COMPUTATION_STRATEGY
): ActorRenderPlacement[] {
  const cacheKey = createActorPlacementCacheKey(
    encounter,
    POLYGON_LAYOUT_SETTINGS,
    FLEX_ZONE_EDGE_GAP
  );
  const geometry = getCachedActorPlacementGeometry(cacheKey);

  const renderGeometry =
    geometry ?? getLastActorPlacementGeometry(encounter) ?? [];
  const currentGeometry = renderGeometry.filter(({ actorId }) => {
    const actor = encounter.actors.byId[actorId];

    return Boolean(
      actor &&
      actor.currentZoneId !== ZONELESS_ACTOR_ZONE_ID &&
      encounter.zones.byId[actor.currentZoneId] &&
      (geometry || !getOptimisticActorPlacement(actorId))
    );
  });
  const positionedActorIds = new Set(
    currentGeometry.map(({ actorId }) => actorId)
  );
  encounter.actors.allIds.forEach((actorId) => {
    const actor = encounter.actors.byId[actorId];

    if (
      !actor ||
      actor.currentZoneId === ZONELESS_ACTOR_ZONE_ID ||
      !encounter.zones.byId[actor.currentZoneId]
    ) {
      clearOptimisticActorPlacement(actorId);
    }
  });

  const geometryWithOptimisticPlacements: ActorPlacementGeometry[] = [
    ...currentGeometry,
    ...encounter.actors.allIds.flatMap((actorId) => {
      if (positionedActorIds.has(actorId)) {
        return [];
      }

      const actor = encounter.actors.byId[actorId];
      const point = actor ? getOptimisticActorPlacement(actorId) : undefined;

      return actor && point
        ? [{ actorId, point, radius: getActorRadius(actor) }]
        : [];
    })
  ];
  const proactiveGeometry: ActorPlacementGeometry[] =
    computationStrategy === 'PROACTIVE'
      ? geometryWithOptimisticPlacements.map((placement) => ({ ...placement }))
      : geometryWithOptimisticPlacements;
  const plannedZoneIds = new Set<string>();
  const knownGeometry: ActorPlacementGeometry[] = [];

  if (computationStrategy === 'PROACTIVE') {
    for (const zoneId of encounter.zones.allIds) {
      const zone = encounter.zones.byId[zoneId];

      if (!zone) {
        continue;
      }

      const zoneActors = encounter.actors.allIds.flatMap((actorId) => {
        const actor = encounter.actors.byId[actorId];

        return actor?.currentZoneId === zoneId ? [actor] : [];
      });
      const plannedZoneGeometry = getProactiveActorPlacementGeometry(
        zone,
        zoneActors,
        POLYGON_LAYOUT_SETTINGS
      );

      if (!plannedZoneGeometry) {
        continue;
      }

      const plannedByActorId = new Map(
        plannedZoneGeometry.map((placement) => [placement.actorId, placement])
      );
      const planCoversZone = zoneActors.every((actor) =>
        plannedByActorId.has(actor.id)
      );

      if (!planCoversZone) {
        continue;
      }

      plannedZoneIds.add(zoneId);
      knownGeometry.push(...plannedZoneGeometry);
      proactiveGeometry.forEach((placement, index) => {
        const actor = encounter.actors.byId[placement.actorId];

        if (actor?.currentZoneId !== zoneId) {
          return;
        }

        const planned = plannedByActorId.get(placement.actorId);

        if (planned) {
          proactiveGeometry[index] = planned;
        }
      });
    }
  }

  if (!geometry) {
    const authoritativeZoneIds = encounter.zones.allIds.filter((zoneId) => {
      if (plannedZoneIds.has(zoneId)) {
        return false;
      }

      return encounter.actors.allIds.some((actorId) => {
        const actor = encounter.actors.byId[actorId];

        return actor?.currentZoneId === zoneId;
      });
    });

    requestActorPlacementComputation(encounter, POLYGON_LAYOUT_SETTINGS, {
      authoritativeZoneIds,
      computationStrategy,
      knownGeometry
    });

    if (!hasActorPlacementWorker()) {
      return getActorRenderPlacements(encounter, computationStrategy);
    }
  }

  return proactiveGeometry.flatMap(
    ({ actorId, engagementTokenPoint, point, radius, sectionPolygon }) => {
    const actor = encounter.actors.byId[actorId];
    const incomingPoint = getOptimisticActorPlacement(actorId);

    return actor
      ? [
          {
            actor,
            ...(engagementTokenPoint ? { engagementTokenPoint } : {}),
            ...(incomingPoint ? { incomingPoint } : {}),
            point,
            radius,
            ...(sectionPolygon ? { sectionPolygon } : {})
          }
        ]
      : [];
    }
  );
}

export { getProactiveActorPlacementGeometry };
