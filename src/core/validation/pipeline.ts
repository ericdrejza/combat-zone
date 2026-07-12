import type { EncounterState } from "../encounter/types";
import type {
  ValidationAction,
  ValidationMode,
  ValidationPipelineResult,
  ValidationResult,
  Validator
} from "./types";
import { MVP_VALIDATORS } from "./validators";

export type RunValidationPipelineInput = {
  state: EncounterState;
  action: ValidationAction;
  mode?: ValidationMode;
  validators?: Validator<EncounterState>[];
};

export function runValidationPipeline({
  state,
  action,
  mode = state.validationState.mode,
  validators = MVP_VALIDATORS
}: RunValidationPipelineInput): ValidationPipelineResult {
  if (mode === "OFF") {
    return {
      mode,
      valid: true,
      blocked: false,
      messages: []
    };
  }

  const messages = validators.flatMap(
    (validator) => validator.validate(action, { state, mode }).messages
  );
  const result = createValidationResult(messages);

  return {
    ...result,
    mode,
    blocked: mode === "STRICT" && !result.valid
  };
}

export function createValidationResult(
  messages: ValidationResult["messages"]
): ValidationResult {
  return {
    valid: messages.every((message) => message.severity !== "error"),
    messages
  };
}
