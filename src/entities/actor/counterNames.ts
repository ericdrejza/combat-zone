import type { ActorCounters } from "./actorResources";

/** Reuses numbering gaps instead of maintaining a separate persisted sequence. */
export function getAvailableCounterName(counters?: ActorCounters): string {
  const names = new Set((counters?.allIds ?? []).map((id) => counters!.byId[id].name.trim()));
  let number = 1;
  while (names.has(`Counter ${number}`)) number += 1;
  return `Counter ${number}`;
}
