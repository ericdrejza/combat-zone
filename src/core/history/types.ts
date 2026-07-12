import type { ValidationResult } from "../validation/types";
import type { EncounterState } from "../encounter/types";

export type JsonPrimitive = string | number | boolean | null;

export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | {
      [key: string]: JsonValue;
    };

export type JsonObject = {
  [key: string]: JsonValue;
};

export type EncounterActionRecord<TPayload extends JsonObject = JsonObject> = {
  id: string;
  type: string;
  timestamp: number;
  payload: TPayload;
  validationResult?: ValidationResult;
};

export type EncounterHistoryEntry = {
  action: EncounterActionRecord;
  snapshot: EncounterState;
};

export type EncounterHistoryState = {
  past: EncounterHistoryEntry[];
  present: EncounterState;
  future: EncounterHistoryEntry[];
};

export function createEncounterHistoryState(
  present: EncounterState
): EncounterHistoryState {
  return {
    past: [],
    present,
    future: []
  };
}

export function canUndoEncounterHistory(history: EncounterHistoryState): boolean {
  return history.past.length > 0;
}

export function canRedoEncounterHistory(history: EncounterHistoryState): boolean {
  return history.future.length > 0;
}
