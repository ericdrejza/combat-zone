import type { EncounterState } from "@core/encounter/types";
import { ZONELESS_ACTOR_ZONE_ID } from "@core/encounter/types";
import { moveActorsPreservingCompleteEngagements } from "@entities/engagement/engagementMutations";
import { updateActorProperties } from "./actorMutations";
import type { ActorSize } from "./types";

/** Group by destination so only complete, co-moving Engagements retain membership. */
export function moveActorsByDestination(state: EncounterState, destinations: Record<string, string>): EncounterState {
  const groups = new Map<string, string[]>();
  for (const [id, destination] of Object.entries(destinations)) {
    const actor = state.actors.byId[id];
    if (!actor || !state.zones.byId[destination] || actor.currentZoneId === destination) continue;
    groups.set(destination, [...(groups.get(destination) ?? []), id]);
  }
  let next = state;
  for (const [destination, ids] of groups) next = moveActorsPreservingCompleteEngagements(next, ids, destination);
  return next;
}

export function stepActorSizes(state: EncounterState, ids: readonly string[], direction: -1 | 1): EncounterState {
  const sizes: ActorSize[] = ["small", "medium", "large", "xLarge"];
  return ids.reduce((next, id) => {
    const actor = next.actors.byId[id];
    if (!actor) return next;
    const size = sizes[sizes.indexOf(actor.size) + direction];
    return size ? updateActorProperties(next, id, { size }) : next;
  }, state);
}

/** A source zone takes precedence; zoneless/missing sources use a selected target. */
export function getActorPasteDestination(state: EncounterState, sourceId: string, selectedZoneId?: string | null): string {
  const source = state.actors.byId[sourceId];
  if (source && state.zones.byId[source.currentZoneId]) return source.currentZoneId;
  return selectedZoneId && state.zones.byId[selectedZoneId] ? selectedZoneId : ZONELESS_ACTOR_ZONE_ID;
}
