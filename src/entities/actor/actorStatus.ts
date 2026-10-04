import type { EncounterState } from "@core/encounter/types";
import type { Actor, ActorStatus } from "./types";

export function getActorStatus(actor: Actor): ActorStatus {
  return actor.status ?? 3;
}

export function isActorStatus(value: unknown): value is ActorStatus {
  return value === 0 || value === 1 || value === 2 || value === 3;
}

/** Changes health independently of initiative membership and active turns. */
export function updateActorStatus(
  state: EncounterState,
  actorId: string,
  status: ActorStatus
): EncounterState {
  const actor = state.actors.byId[actorId];
  if (!actor || getActorStatus(actor) === status) return state;
  return {
    ...state,
    actors: {
      ...state.actors,
      byId: { ...state.actors.byId, [actorId]: { ...actor, status } }
    }
  };
}
