import type { EncounterState } from "../encounter/types";
import type { EncounterActionRecord } from "../history/types";
import { runValidationPipeline } from "./pipeline";
import type {
  ValidationAction,
  ValidationPipelineResult,
  Validator
} from "./types";

export type PrepareValidatedEncounterChangeInput = {
  currentEncounter: EncounterState;
  nextEncounter: EncounterState;
  action: EncounterActionRecord;
  validators?: Validator<EncounterState>[];
};

export type PreparedValidatedEncounterChange = {
  blocked: boolean;
  action: EncounterActionRecord;
  nextEncounter: EncounterState;
  validationResult: ValidationPipelineResult;
};

export function prepareValidatedEncounterChange({
  currentEncounter,
  nextEncounter,
  action,
  validators
}: PrepareValidatedEncounterChangeInput): PreparedValidatedEncounterChange {
  const validationAction: ValidationAction = {
    type: action.type,
    payload: action.payload
  };
  const validationResult = runValidationPipeline({
    state: currentEncounter,
    action: validationAction,
    validators
  });
  const actionWithValidation: EncounterActionRecord = {
    ...action,
    validationResult: {
      valid: validationResult.valid,
      messages: validationResult.messages
    }
  };

  return {
    blocked: validationResult.blocked,
    action: actionWithValidation,
    nextEncounter: {
      ...nextEncounter,
      validationState: {
        ...nextEncounter.validationState,
        mode: currentEncounter.validationState.mode,
        messages: validationResult.messages
      }
    },
    validationResult
  };
}
