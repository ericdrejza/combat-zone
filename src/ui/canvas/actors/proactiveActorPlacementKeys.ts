import type { PolygonNestingSettings } from '@core/layout/nesting_ts';
import type { Actor, ActorShape, ActorSize } from '@entities/actor/types';
import type { Zone } from '@entities/zone/types';

export const PROACTIVE_ACTOR_ID = '__proactive_actor__';

export function getZonePlanKey(
  zone: Zone,
  actors: Array<Pick<Actor, 'id' | 'size' | 'shape'>>,
  nestingSettings: PolygonNestingSettings,
  normalizeLastActor = false
): string {
  return JSON.stringify([
    zone.id,
    zone.shape,
    zone.layoutStrategy,
    zone.layoutOrientation,
    zone.polygon,
    nestingSettings,
    actors.map((actor, index) => [
      normalizeLastActor && index === actors.length - 1
        ? PROACTIVE_ACTOR_ID
        : actor.id,
      actor.size,
      actor.shape
    ])
  ]);
}

export function getPlanKey(
  zone: Zone,
  actors: Actor[],
  nestingSettings: PolygonNestingSettings,
  incomingSize: ActorSize,
  incomingShape: ActorShape
): string {
  return getZonePlanKey(
    zone,
    [
      ...actors,
      {
        id: PROACTIVE_ACTOR_ID,
        size: incomingSize,
        shape: incomingShape
      }
    ],
    nestingSettings
  );
}
