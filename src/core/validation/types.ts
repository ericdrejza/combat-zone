import type { JsonObject } from "../history/types";

export type ValidationSeverity = "info" | "warning" | "error";
export type ValidationMode = "OFF" | "ADVISORY" | "ASSISTED" | "STRICT";

export type ValidationMessage = {
  code: string;
  message: string;
  severity: ValidationSeverity;
};

export type ValidationResult = {
  valid: boolean;
  messages: ValidationMessage[];
  blocked?: boolean;
};

export type ValidationAction<TPayload extends JsonObject = JsonObject> = {
  type: string;
  payload: TPayload;
};

export type ValidationContext<TState> = {
  state: TState;
  mode: ValidationMode;
  nextState?: TState;
};

export type Validator<TState> = {
  id: string;
  validate(
    action: ValidationAction,
    context: ValidationContext<TState>
  ): ValidationResult;
  runsInOffMode?: boolean;
};

export type ValidationPipelineResult = ValidationResult & {
  mode: ValidationMode;
  blocked: boolean;
};
