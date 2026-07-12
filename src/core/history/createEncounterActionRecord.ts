import type { EncounterActionRecord, JsonObject } from "./types";

export function createEncounterActionRecord(
  type: string,
  payload: JsonObject = {}
): EncounterActionRecord {
  const timestamp = Date.now();

  return {
    id: `${type}-${timestamp}`,
    type,
    timestamp,
    payload,
    validationResult: {
      valid: true,
      messages: []
    }
  };
}
