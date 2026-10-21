import { DEFAULT_RESOURCE_BARS, type ResourceBars } from "@combat-zone/firebase-api";
import type { Actor } from "./types";
export { DEFAULT_RESOURCE_BARS, type ResourceBars } from "@combat-zone/firebase-api";

export function actorResourceBars(actor: Actor): ResourceBars {
  return actor.resourceBars ?? DEFAULT_RESOURCE_BARS;
}

/** Removing a counter or its usable maximum clears its mapping, without restoring health. */
export function setResourceBars(actor: Actor, mapping: ResourceBars): Actor {
  const usable = (id: string) => (actor.counters?.byId[id]?.maximum ?? 0) > 0;
  const next: ResourceBars = {
    ...mapping,
    first: mapping.first?.kind === "health" && mapping.healthDisabled ? null : mapping.first?.kind === "counter" && !usable(mapping.first.counterId) ? null : mapping.first,
    second: mapping.second && (!usable(mapping.second.counterId) ||
      (mapping.first?.kind === "counter" && mapping.first.counterId === mapping.second.counterId)) ? null : mapping.second
  };
  return JSON.stringify(actorResourceBars(actor)) === JSON.stringify(next) ? actor : { ...actor, resourceBars: next };
}

/** Counter toggles restore health unless the health switch explicitly opted out. */
export function mapCounterBar(mapping: ResourceBars, id: string, bar: "first" | "second", enabled: boolean): ResourceBars {
  const fallback: ResourceBars["first"] = mapping.healthDisabled ? null : { kind: "health" };
  if (bar === "first") return { ...mapping, first: enabled ? { kind: "counter", counterId: id } : fallback,
    second: enabled && mapping.second?.counterId === id ? null : mapping.second };
  return { ...mapping, second: enabled ? { kind: "counter", counterId: id } : null,
    first: enabled && mapping.first?.kind === "counter" && mapping.first.counterId === id ? fallback : mapping.first };
}

/** Only the health editor changes the remembered opt-out; counter assignments preserve it. */
export function mapHealthBar(mapping: ResourceBars, enabled: boolean): ResourceBars {
  return { ...mapping, healthDisabled: !enabled, first: enabled ? { kind: "health" } : null };
}

/** Counter deletion and clearing its maximum use the same slot cleanup. */
export function unmapCounterBars(mapping: ResourceBars, counterId: string): ResourceBars {
  const first = mapping.first?.kind === "counter" && mapping.first.counterId === counterId ? null : mapping.first;
  const second = mapping.second?.counterId === counterId ? null : mapping.second;
  return first === mapping.first && second === mapping.second ? mapping : { ...mapping, first, second };
}

/** Progress clamps only the visualization; combat preferences still own HP bounds. */
export function resolvedResourceBars(actor: Actor) {
  const mapping = actorResourceBars(actor);
  return (["first", "second"] as const).flatMap((slot) => {
    const source = mapping[slot];
    const counter = source?.kind === "counter" ? actor.counters?.byId[source.counterId] : undefined;
    const resource = source?.kind === "health" ? actor.hitPoints && {
      name: "Health", value: actor.hitPoints.current, maximum: actor.hitPoints.maximum
    } : counter;
    if (!resource || !resource.maximum || resource.maximum <= 0) return [];
    return [{ slot, name: resource.name, value: resource.value, maximum: resource.maximum,
      fraction: Math.max(0, Math.min(1, resource.value / resource.maximum)) }];
  });
}
