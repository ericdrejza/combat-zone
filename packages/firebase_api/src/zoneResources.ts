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
  const clocks = value.clocks;
  if (clocks === undefined) return;
  if (!record(clocks) || !Array.isArray(clocks.allIds) || !record(clocks.byId) || new Set(clocks.allIds).size !== clocks.allIds.length || Object.keys(clocks.byId).length !== clocks.allIds.length) {
    throw new ApiContractValidationError("Zone clocks are invalid.");
  }
  const byId = clocks.byId;
  for (const id of clocks.allIds) {
    const clock = typeof id === "string" ? byId[id] : null;
    if (!record(clock) || clock.id !== id || typeof clock.name !== "string" || !clock.name.trim() ||
      (clock.style !== undefined && clock.style !== "traditional" && clock.style !== "linear") ||
      !Number.isSafeInteger(clock.segments) || (clock.segments as number) < 1 || (clock.segments as number) > 12 ||
      !Number.isSafeInteger(clock.value) || (clock.value as number) < 0 || (clock.value as number) > (clock.segments as number)) {
      throw new ApiContractValidationError("Zone clock progress, segments, or style are invalid.");
    }
  }
}
