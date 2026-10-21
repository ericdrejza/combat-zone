export type CounterBarSource = { kind: "counter"; counterId: string };
export type ResourceBars = {
  /** Remembers an explicit health-switch opt-out while a counter occupies slot one. */
  healthDisabled?: boolean;
  first: { kind: "health" } | CounterBarSource | null;
  second: CounterBarSource | null;
};
export const DEFAULT_RESOURCE_BARS: ResourceBars = { first: { kind: "health" }, second: null };

/** Mappings reference actor-owned counters; values remain authoritative on each resource. */
export function validResourceBars(value: unknown, counters: unknown): boolean {
  if (value === undefined) return true;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const { first, second, healthDisabled } = value as ResourceBars;
  if (healthDisabled !== undefined && typeof healthDisabled !== "boolean") return false;
  if (healthDisabled && first?.kind === "health") return false;
  const byId = (counters as { byId?: Record<string, { maximum?: number }> } | undefined)?.byId;
  const valid = (source: unknown, health: boolean) => {
    if (source === null) return true;
    if (!source || typeof source !== "object" || Array.isArray(source)) return false;
    const entry = source as { kind?: unknown; counterId?: unknown };
    if (health && entry.kind === "health") return true;
    if (entry.kind !== "counter" || typeof entry.counterId !== "string") return false;
    const maximum = byId?.[entry.counterId]?.maximum;
    return Number.isSafeInteger(maximum) && maximum! > 0;
  };
  return valid(first, true) && valid(second, false) &&
    !(first?.kind === "counter" && second?.kind === "counter" && first.counterId === second.counterId);
}
