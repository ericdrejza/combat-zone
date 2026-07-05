import type { ValidationResult } from "../validation/types";

export type Command<TState, TPayload = unknown> = {
  id: string;
  type: string;
  timestamp: number;
  payload: TPayload;
  inversePayload: TPayload;
  do(state: TState): TState;
  undo(state: TState): TState;
  validationResult?: ValidationResult;
};
