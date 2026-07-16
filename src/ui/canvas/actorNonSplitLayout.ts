import type { NestingActor } from '@core/layout/nesting_ts';
import {
  packPolygonFlexActors,
  packPolygonSequentialActors
} from '@core/layout/polygonFlexLayout';
import type { Zone } from '@entities/zone/types';
import type { ActorPlacementGeometry } from './actorPlacementCache';

/** Calculates only non-split polygon layouts for the proactive planner. */
export function calculateNonSplitZonePlacementGeometry(
  zone: Zone,
  actors: NestingActor[]
): ActorPlacementGeometry[] | undefined {
  const result =
    zone.layoutStrategy === 'FLEX'
      ? packPolygonFlexActors({ actors, polygon: zone.polygon })
      : zone.layoutStrategy === 'SEQUENTIAL'
        ? packPolygonSequentialActors({ actors, polygon: zone.polygon })
        : undefined;

  if (!result?.fits) {
    return undefined;
  }

  return actors.flatMap((actor) => {
    const point = result.placements[actor.id];

    return point ? [{ actorId: actor.id, point, radius: actor.radius }] : [];
  });
}
