import type { EncounterState } from "@core/encounter/types";
import type { EncounterActionRecord } from "@core/history/types";

type Snapshots = { before: EncounterState; after: EncounterState };

/** Reuses single-destination wording without claiming every actor took the same route. */
export function formatActorMovementDestinations(action: EncounterActionRecord, snapshots: Snapshots,
  formatGroup: (action: EncounterActionRecord, snapshots: Snapshots) => string): string | null {
  const { destinations, ...payload } = action.payload;
  if (action.type !== "actor.moveMany" || !destinations || Array.isArray(destinations) || typeof destinations !== "object") return null;
  const groups = new Map<string, string[]>();
  for (const [id, destination] of Object.entries(destinations)) {
    if (typeof destination !== "string" || snapshots.before.actors.byId[id]?.currentZoneId === destination) continue;
    groups.set(destination, [...(groups.get(destination) ?? []), id]);
  }
  return [...groups].map(([destinationZoneId, actorIds]) => formatGroup({ ...action, payload: { ...payload, actorIds, destinationZoneId } }, snapshots)).join(" ");
}
