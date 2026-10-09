import { validClocks } from "@core/entity_resources/statusResources";
import type { EncounterState } from "@core/encounter/types";
import { validCounters } from "@core/entity_resources/counters";
import type { Zone } from "./types";

export { clockCounter, clockCounters, saveResourceCounter as saveZoneCounter, removeResourceCounter as removeZoneCounter, saveResourceClock as saveZoneClock, removeResourceClock as removeZoneClock } from "@core/entity_resources/statusResources";
export type { Clock as ZoneClock, Clocks as ZoneClocks, ClockCounter } from "@core/entity_resources/statusResources";

export function validZoneResources(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const zone = value as Zone;
  if (!Array.isArray(zone.tags) || !zone.tags.every((tag) => typeof tag === "string") ||
    (zone.notes !== undefined && typeof zone.notes !== "string") || !validCounters(zone.counters)) return false;
  return validClocks(zone.clocks);
}

/** Resolve the owning Zone from current state after asynchronous validation. */
export function updateZoneStatus(state: EncounterState, zoneId: string, mutate: (zone: Zone) => Zone): EncounterState {
  const zone = state.zones.byId[zoneId];
  if (!zone) return state;
  const next = mutate(zone);
  return next === zone ? state : { ...state, zones: { ...state.zones, byId: { ...state.zones.byId, [zoneId]: next } } };
}
