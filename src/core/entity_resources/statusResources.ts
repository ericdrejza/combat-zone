import { DEFAULT_CLOCK_STYLE, isClockStyle, type ClockStyle } from "./clockStyle";
import type { EntityCollection } from "@core/state/entityCollection";
import { removeCollectionCounter, saveCollectionCounter, type Counter, type Counters } from "./counters";

export type Clock = { id: string; name: string; value: number; segments: number; style?: ClockStyle };
export type ClockCounter = Counter & { style?: ClockStyle };
export type Clocks = EntityCollection<Clock>;

/** Counter-shaped adapters are derived UI drafts, never durable clock facts. */
export function clockCounter(clock: Clock): ClockCounter {
  return { id: clock.id, name: clock.name, value: clock.value, minimum: 0, maximum: clock.segments, style: clock.style ?? DEFAULT_CLOCK_STYLE };
}
export function clockCounters(clocks?: Clocks): EntityCollection<ClockCounter> {
  return { allIds: clocks?.allIds ?? [], byId: Object.fromEntries((clocks?.allIds ?? []).map((id) => [id, clockCounter(clocks!.byId[id])])) };
}
export type StatusResources = { counters?: Counters; clocks?: Clocks };

export function validClocks(value: unknown): boolean {
  const clocks = value as Clocks | undefined;
  if (clocks === undefined) return true;
  if (!clocks || typeof clocks !== "object" || Array.isArray(clocks) || !Array.isArray(clocks.allIds) || !clocks.byId || typeof clocks.byId !== "object" || Array.isArray(clocks.byId) ||
    new Set(clocks.allIds).size !== clocks.allIds.length || Object.keys(clocks.byId).length !== clocks.allIds.length) return false;
  return clocks.allIds.every((id) => {
    const clock = clocks.byId[id];
    return typeof id === "string" && !!clock && clock.id === id && typeof clock.name === "string" && !!clock.name.trim() &&
      (clock.style === undefined || isClockStyle(clock.style)) && Number.isSafeInteger(clock.segments) && clock.segments >= 1 && clock.segments <= 12 &&
      Number.isSafeInteger(clock.value) && clock.value >= 0 && clock.value <= clock.segments;
  });
}

export function saveResourceCounter<T extends StatusResources>(owner: T, counter: Counter): T {
  const counters = saveCollectionCounter(owner.counters, counter);
  return counters === owner.counters ? owner : { ...owner, counters };
}
export function removeResourceCounter<T extends StatusResources>(owner: T, id: string): T {
  const counters = removeCollectionCounter(owner.counters, id);
  return counters === owner.counters ? owner : { ...owner, counters };
}
export function saveResourceClock<T extends StatusResources>(owner: T, input: Clock): T {
  const clock = { ...input, style: input.style ?? DEFAULT_CLOCK_STYLE, value: Math.max(0, Math.min(input.segments, input.value)) };
  const clocks = owner.clocks ?? { allIds: [], byId: {} };
  const old = clocks.byId[clock.id];
  if (old && old.name === clock.name && old.value === clock.value && old.segments === clock.segments && (old.style ?? DEFAULT_CLOCK_STYLE) === clock.style) return owner;
  return { ...owner, clocks: { allIds: old ? clocks.allIds : [...clocks.allIds, clock.id], byId: { ...clocks.byId, [clock.id]: clock } } };
}
export function removeResourceClock<T extends StatusResources>(owner: T, id: string): T {
  if (!owner.clocks?.byId[id]) return owner;
  const byId = { ...owner.clocks.byId };
  delete byId[id];
  return { ...owner, clocks: { allIds: owner.clocks.allIds.filter((value) => value !== id), byId } };
}
