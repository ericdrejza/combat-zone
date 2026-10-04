import type { EntityCollection } from "@core/state/entityCollection";

export type Counter = { id: string; name: string; value: number; minimum?: number; maximum?: number };
export type Counters = EntityCollection<Counter>;

/** Bounds belong to the resource, independently of combat preferences. */
export function normalizeCounter(counter: Counter): Counter {
  return { ...counter, value: Math.max(counter.minimum ?? -Infinity, Math.min(counter.maximum ?? Infinity, counter.value)) };
}

export function validCounters(value: unknown): boolean {
  const counters = value as Counters | undefined;
  if (counters === undefined) return true;
  if (!counters || Array.isArray(counters) || !Array.isArray(counters.allIds) || !counters.byId || typeof counters.byId !== "object" || Array.isArray(counters.byId) ||
    new Set(counters.allIds).size !== counters.allIds.length || Object.keys(counters.byId).length !== counters.allIds.length) return false;
  return counters.allIds.every((id) => {
    const c = counters.byId[id];
    return typeof id === "string" && !!c && c.id === id && typeof c.name === "string" && c.name.trim().length > 0 &&
      Number.isSafeInteger(c.value) && (c.minimum === undefined || Number.isSafeInteger(c.minimum)) &&
      (c.maximum === undefined || Number.isSafeInteger(c.maximum)) && (c.minimum ?? -Infinity) <= (c.maximum ?? Infinity) &&
      c.value >= (c.minimum ?? -Infinity) && c.value <= (c.maximum ?? Infinity);
  });
}

/** Preserve collection identity for ineffective edits so history remains unchanged. */
export function saveCollectionCounter(collection: Counters | undefined, input: Counter): Counters {
  const counter = normalizeCounter(input);
  const counters = collection ?? { allIds: [], byId: {} };
  const previous = counters.byId[counter.id];
  if (previous && previous.name === counter.name && previous.value === counter.value && previous.minimum === counter.minimum && previous.maximum === counter.maximum) return counters;
  return { allIds: previous ? counters.allIds : [...counters.allIds, counter.id], byId: { ...counters.byId, [counter.id]: counter } };
}

export function removeCollectionCounter(counters: Counters | undefined, id: string): Counters | undefined {
  if (!counters?.byId[id]) return counters;
  const byId = { ...counters.byId };
  delete byId[id];
  return { byId, allIds: counters.allIds.filter((value) => value !== id) };
}

/** Reuse numbering gaps without persisting a separate sequence. */
export function getAvailableCounterName(counters?: Counters, prefix = "Counter"): string {
  const names = new Set((counters?.allIds ?? []).map((id) => counters!.byId[id].name.trim()));
  let number = 1;
  while (names.has(`${prefix} ${number}`)) number += 1;
  return `${prefix} ${number}`;
}
