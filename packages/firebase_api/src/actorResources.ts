import { ApiContractValidationError } from "./errors.js";

type RecordValue = Record<string, unknown>;
const record = (value: unknown): value is RecordValue => !!value && typeof value === "object" && !Array.isArray(value);
/** Resource validation is independent of client-specific health automation preferences. */
export function validateActorResources(value: unknown): void {
  if (!record(value)) throw new ApiContractValidationError("Actor must be an object.");
  const hp = value.hitPoints;
  if (hp !== undefined && (!record(hp) || !Number.isSafeInteger(hp.current) || !Number.isSafeInteger(hp.maximum) || (hp.maximum as number) <= 0)) {
    throw new ApiContractValidationError("Actor hit points are invalid.");
  }
  const counters = value.counters;
  if (counters === undefined) return;
  if (!record(counters) || !Array.isArray(counters.allIds) || !record(counters.byId) ||
    new Set(counters.allIds).size !== counters.allIds.length || Object.keys(counters.byId).length !== counters.allIds.length) {
    throw new ApiContractValidationError("Actor counters are invalid.");
  }
  const byId = counters.byId;
  for (const id of counters.allIds) {
    const counter = typeof id === "string" ? byId[id] : null;
    if (!record(counter) || counter.id !== id || typeof counter.name !== "string" || !counter.name.trim() ||
      !Number.isSafeInteger(counter.value) || (counter.minimum !== undefined && !Number.isSafeInteger(counter.minimum)) ||
      (counter.maximum !== undefined && !Number.isSafeInteger(counter.maximum)) ||
      ((counter.minimum as number | undefined) ?? -Infinity) > ((counter.maximum as number | undefined) ?? Infinity) ||
      (counter.value as number) < ((counter.minimum as number | undefined) ?? -Infinity) || (counter.value as number) > ((counter.maximum as number | undefined) ?? Infinity)) {
      throw new ApiContractValidationError("Actor counter values or bounds are invalid.");
    }
  }
}
