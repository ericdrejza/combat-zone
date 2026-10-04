import { validateCounters } from "./counters.js";
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
  validateCounters(value.counters);
}
