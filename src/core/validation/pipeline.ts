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
  nextState?: EncounterState;
  action: ValidationAction;
  mode?: ValidationMode;
  validators?: Validator<EncounterState>[];
};

export function runValidationPipeline({
  state,
  nextState,
  action,
  mode = state.validationState.mode,
  validators = MVP_VALIDATORS
}: RunValidationPipelineInput): ValidationPipelineResult {
  const activeValidators =
    mode === "OFF"
      ? validators.filter((validator) => validator.runsInOffMode)
      : validators;
  const validationResults = activeValidators.map((validator) =>
    validator.validate(action, { state, mode, nextState })
  );
  const messages = validationResults.flatMap((result) => result.messages);
  const result = createValidationResult(messages);

  return {
    ...result,
    mode,
    blocked:
      validationResults.some((validationResult) => validationResult.blocked) ||
      (mode === "STRICT" && !result.valid)
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
