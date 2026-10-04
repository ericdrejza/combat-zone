import { DEFAULT_CLOCK_STYLE, isClockStyle, type ClockStyle } from "./clockStyle";
import type { EncounterState } from "@core/encounter/types";
import type { EntityCollection } from "@core/state/entityCollection";
import { removeCollectionCounter, saveCollectionCounter, validCounters, type Counter, type Counters } from "@core/entity_resources/counters";
import type { Zone } from "./types";

export type ZoneClock = { id: string; name: string; value: number; segments: number; style?: ClockStyle };
export type ClockCounter = Counter & { style?: ClockStyle };
export type ZoneClocks = EntityCollection<ZoneClock>;

/** Counter-shaped adapters are derived UI drafts, never durable clock facts. */
export function clockCounter(clock: ZoneClock): ClockCounter {
  return { id: clock.id, name: clock.name, value: clock.value, minimum: 0, maximum: clock.segments, style: clock.style ?? DEFAULT_CLOCK_STYLE };
}
export function clockCounters(clocks?: ZoneClocks): EntityCollection<ClockCounter> {
  return { allIds: clocks?.allIds ?? [], byId: Object.fromEntries((clocks?.allIds ?? []).map((id) => [id, clockCounter(clocks!.byId[id])])) };
}
export function validZoneResources(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const zone = value as Zone;
  if (!Array.isArray(zone.tags) || !zone.tags.every((tag) => typeof tag === "string") ||
    (zone.notes !== undefined && typeof zone.notes !== "string") || !validCounters(zone.counters)) return false;
  const clocks = zone.clocks;
  if (clocks === undefined) return true;
  if (!clocks || Array.isArray(clocks) || !Array.isArray(clocks.allIds) || !clocks.byId || typeof clocks.byId !== "object" || Array.isArray(clocks.byId) ||
    new Set(clocks.allIds).size !== clocks.allIds.length || Object.keys(clocks.byId).length !== clocks.allIds.length) return false;
  return clocks.allIds.every((id) => {
    const clock = clocks.byId[id];
    return typeof id === "string" && !!clock && clock.id === id && typeof clock.name === "string" && !!clock.name.trim() &&
      (clock.style === undefined || isClockStyle(clock.style)) && Number.isSafeInteger(clock.segments) && clock.segments >= 1 && clock.segments <= 12 &&
      Number.isSafeInteger(clock.value) && clock.value >= 0 && clock.value <= clock.segments;
  });
}

/** Resolve the owning Zone from current state after asynchronous validation. */
export function updateZoneStatus(state: EncounterState, zoneId: string, mutate: (zone: Zone) => Zone): EncounterState {
  const zone = state.zones.byId[zoneId];
  if (!zone) return state;
  const next = mutate(zone);
  return next === zone ? state : { ...state, zones: { ...state.zones, byId: { ...state.zones.byId, [zoneId]: next } } };
}
export function saveZoneCounter(zone: Zone, counter: Counter): Zone {
  const counters = saveCollectionCounter(zone.counters, counter);
  return counters === zone.counters ? zone : { ...zone, counters };
}
export function removeZoneCounter(zone: Zone, id: string): Zone {
  const counters = removeCollectionCounter(zone.counters, id);
  return counters === zone.counters ? zone : { ...zone, counters };
}
export function saveZoneClock(zone: Zone, input: ZoneClock): Zone {
  const clock = { ...input, style: input.style ?? DEFAULT_CLOCK_STYLE, value: Math.max(0, Math.min(input.segments, input.value)) };
  const clocks = zone.clocks ?? { allIds: [], byId: {} };
  const old = clocks.byId[clock.id];
  if (old && old.name === clock.name && old.value === clock.value && old.segments === clock.segments && (old.style ?? DEFAULT_CLOCK_STYLE) === clock.style) return zone;
  return { ...zone, clocks: { allIds: old ? clocks.allIds : [...clocks.allIds, clock.id], byId: { ...clocks.byId, [clock.id]: clock } } };
}
export function removeZoneClock(zone: Zone, id: string): Zone {
  if (!zone.clocks?.byId[id]) return zone;
  const byId = { ...zone.clocks.byId };
  delete byId[id];
  return { ...zone, clocks: { allIds: zone.clocks.allIds.filter((value) => value !== id), byId } };
}
