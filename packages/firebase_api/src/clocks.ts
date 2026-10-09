import { ApiContractValidationError } from "./errors.js";
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);

export function validateClocks(clocks: unknown, owner: string): void {
  if (clocks === undefined) return;
  if (!record(clocks) || !Array.isArray(clocks.allIds) || !record(clocks.byId) || new Set(clocks.allIds).size !== clocks.allIds.length || Object.keys(clocks.byId).length !== clocks.allIds.length) {
    throw new ApiContractValidationError(`${owner} clocks are invalid.`);
  }
  const byId = clocks.byId;
  for (const id of clocks.allIds) {
    const clock = typeof id === "string" ? byId[id] : null;
    if (!record(clock) || clock.id !== id || typeof clock.name !== "string" || !clock.name.trim() ||
      (clock.style !== undefined && clock.style !== "traditional" && clock.style !== "box" && clock.style !== "stack" && clock.style !== "row") ||
      !Number.isSafeInteger(clock.segments) || (clock.segments as number) < 1 || (clock.segments as number) > 12 ||
      !Number.isSafeInteger(clock.value) || (clock.value as number) < 0 || (clock.value as number) > (clock.segments as number)) {
      throw new ApiContractValidationError(`${owner} clock progress, segments, or style are invalid.`);
    }
  }
}
