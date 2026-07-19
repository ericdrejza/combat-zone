import type { Actor } from '@entities/actor/types';
import { ACTOR_SIZE_MULTIPLIERS } from '@entities/actor/actorVisuals';
import type { NestingActor } from './nesting_ts';

export const ACTOR_TOKEN_BASE_RADIUS = 30;

export function getActorRadius(actor: Actor): number {
  return ACTOR_TOKEN_BASE_RADIUS * ACTOR_SIZE_MULTIPLIERS[actor.size];
}

/** Returns the radius used when calculating the minimum zone footprint. */
export function getMinimumActorRadius(): number {
  return ACTOR_TOKEN_BASE_RADIUS * ACTOR_SIZE_MULTIPLIERS.medium;
}

export function toNestingActor(actor: Actor): NestingActor {
  return {
    id: actor.id,
    radius: getActorRadius(actor),
    shape: actor.shape,
    layoutGroup: actor.layoutGroup
  };
}
