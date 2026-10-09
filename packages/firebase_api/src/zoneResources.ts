import { validateClocks } from "./clocks.js";
import { ApiContractValidationError } from "./errors.js";
import { validateCounters } from "./counters.js";

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
/** Clock limits are domain rules, independent of client display preferences. */
export function validateZoneResources(value: unknown): void {
  if (!record(value)) throw new ApiContractValidationError("Zone must be an object.");
  if (!Array.isArray(value.tags) || value.tags.some((tag) => typeof tag !== "string") || (value.notes !== undefined && typeof value.notes !== "string")) {
    throw new ApiContractValidationError("Zone tags or notes are invalid.");
  }
  validateCounters(value.counters, "Zone");
  validateClocks(value.clocks, "Zone");
}
