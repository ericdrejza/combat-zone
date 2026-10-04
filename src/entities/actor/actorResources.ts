import type { EntityCollection } from "@core/state/entityCollection";
import type { ActorStatus } from "./types";

export type HitPoints = { current: number; maximum: number };
export type ActorCounter = { id: string; name: string; value: number; minimum?: number; maximum?: number };
export type ActorCounters = EntityCollection<ActorCounter>;
export type CombatRules = {
  limits: "bounded" | "negative" | "unbounded";
  automaticHealth: boolean;
  unit: "fixed" | "percent";
  thresholds: [number | null, number | null, number | null];
};
export const DEFAULT_COMBAT_RULES: CombatRules = {
  limits: "bounded", automaticHealth: false, unit: "fixed", thresholds: [null, null, null]
};

export function validThresholds(rules: CombatRules): boolean {
  const configured = rules.thresholds.filter((value): value is number => value !== null);
  return configured.length > 0 && configured.every((value, index) => Number.isSafeInteger(value) &&
    (rules.unit === "fixed" || (value >= 0 && value <= 100)) &&
    (index === 0 || configured[index - 1] <= value));
}

export function normalizeHitPoints(hp: HitPoints, rules: CombatRules): HitPoints {
  return { maximum: hp.maximum, current: Math.max(rules.limits === "bounded" ? 0 : -Infinity,
    Math.min(rules.limits === "unbounded" ? Infinity : hp.maximum, hp.current)) };
}

export function automaticStatus(hp: HitPoints, rules: CombatRules, currentStatus: ActorStatus = 3): ActorStatus {
  if (!validThresholds(rules)) throw new Error("Configure ordered health thresholds before enabling automatic health.");
  // An unconfigured status remains under manual control, including manual death.
  if (currentStatus !== 3 && rules.thresholds[currentStatus] === null) return currentStatus;
  const value = rules.unit === "percent" ? hp.current * 100 / hp.maximum : hp.current;
  const index = rules.thresholds.findIndex((threshold) => threshold !== null && value <= threshold);
  return (index < 0 ? 3 : index) as ActorStatus;
}

export function normalizeCounter(counter: ActorCounter): ActorCounter {
  return { ...counter, value: Math.max(counter.minimum ?? -Infinity, Math.min(counter.maximum ?? Infinity, counter.value)) };
}

/** Structural checks also apply on load, independently of local combat preferences. */
export function validActorResources(actor: { hitPoints?: unknown; counters?: unknown }): boolean {
  if (!actor || typeof actor !== "object" || Array.isArray(actor)) return false;
  const hp = actor.hitPoints as HitPoints | undefined;
  if (hp !== undefined && (!hp || !Number.isSafeInteger(hp.current) || !Number.isSafeInteger(hp.maximum) || hp.maximum <= 0)) return false;
  const counters = actor.counters as ActorCounters | undefined;
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
