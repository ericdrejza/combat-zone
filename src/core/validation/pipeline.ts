import type { EncounterState } from "../encounter/types";
import { getComputationResource } from "../computationResource";
import type {
  ValidationAction,
  ValidationMode,
  ValidationPipelineResult,
  ValidationResult,
  Validator
} from "./types";
import { MVP_VALIDATORS } from "./validators";
import { runValidatorsInWorker } from "./validationWorkerClient";

export type RunValidationPipelineInput = {
  state: EncounterState;
  nextState?: EncounterState;
  action: ValidationAction;
  mode?: ValidationMode;
  validators?: Validator<EncounterState>[];
};

function getActiveValidators(
  validators: Validator<EncounterState>[],
  mode: ValidationMode
): Validator<EncounterState>[] {
  return mode === "OFF"
    ? validators.filter((validator) => validator.runsInOffMode)
    : validators;
}

function createPipelineResult(
  validationResults: ValidationResult[],
  mode: ValidationMode
): ValidationPipelineResult {
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

export function runValidationPipelineSync({
  state,
  nextState,
  action,
  mode = state.validationState.mode,
  validators = MVP_VALIDATORS
}: RunValidationPipelineInput): ValidationPipelineResult {
  const activeValidators = getActiveValidators(validators, mode);
  const validationResults = activeValidators.map((validator) =>
    validator.validate(action, { state, mode, nextState })
  );

  return createPipelineResult(validationResults, mode);
}

/**
 * Runs validation without occupying the UI thread. WebGPU capability is
 * shared through the computation-resource registry and is included in the
 * worker request so other validator executors can use the same decision.
 */
export async function runValidationPipeline({
  state,
  nextState,
  action,
  mode = state.validationState.mode,
  validators = MVP_VALIDATORS
}: RunValidationPipelineInput): Promise<ValidationPipelineResult> {
  const activeValidators = getActiveValidators(validators, mode);
  const workerResults = runValidatorsInWorker({
    action,
    mode,
    nextState,
    resource: getComputationResource(),
    state,
    validators: activeValidators
  });

  if (workerResults) {
    try {
      return createPipelineResult(await workerResults, mode);
    } catch {
      // A worker can disappear during navigation or hot reload. Validation
      // remains authoritative by falling back to the same pure functions.
    }
  }

  return runValidationPipelineSync({
    action,
    mode,
    nextState,
    state,
    validators
  });
}

/** Backward-compatible explicit synchronous execution for reducers and tests. */
export const runValidationPipelineAsync = runValidationPipeline;

export function createValidationResult(
  messages: ValidationResult["messages"]
): ValidationResult {
  return {
    valid: messages.every((message) => message.severity !== "error"),
    messages
  };
}
