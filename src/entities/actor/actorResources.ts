import { validCounters, type Counter, type Counters } from "@core/entity_resources/counters";
export { normalizeCounter } from "@core/entity_resources/counters";
import type { ActorStatus } from "./types";

export type HitPoints = { current: number; maximum: number };
export type ActorCounter = Counter;
export type ActorCounters = Counters;
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

export function automaticStatus(hp: HitPoints, rules: CombatRules): ActorStatus {
  if (!validThresholds(rules)) throw new Error("Configure ordered health thresholds before enabling automatic health.");
  const value = rules.unit === "percent" ? hp.current * 100 / hp.maximum : hp.current;
  const index = rules.thresholds.findIndex((threshold) => threshold !== null && value <= threshold);
  return (index < 0 ? 3 : index) as ActorStatus;
}

/** Structural checks apply on load independently of combat preferences. */
export function validActorResources(actor: { hitPoints?: unknown; counters?: unknown }): boolean {
  if (!actor || typeof actor !== "object" || Array.isArray(actor)) return false;
  const hp = actor.hitPoints as HitPoints | undefined;
  if (hp !== undefined && (!hp || !Number.isSafeInteger(hp.current) || !Number.isSafeInteger(hp.maximum) || hp.maximum <= 0)) return false;
  return validCounters(actor.counters);
}
