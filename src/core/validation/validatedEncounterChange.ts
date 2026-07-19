import type { EncounterState } from "../encounter/types";
import type { EncounterActionRecord } from "../history/types";
import { adjustPolygonFlexZonesToFit } from "./polygonFlexPlacement";
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
  requiresConfirmation: boolean;
  validationResult: ValidationPipelineResult;
};

function isActorFootprintChange(action: EncounterActionRecord): boolean {
  return (
    action.type === "actor.updateProperties" ||
    action.type === "actor.paint"
  );
}

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
  const shouldConsiderZoneResize =
    action.type === "zone.reshape" ||
    (isActorFootprintChange(action) &&
      currentEncounter.validationState.mode !== "STRICT") ||
    action.type === "actor.create" ||
    action.type === "actor.move" ||
    action.type === "actor.moveMany";
  const adjustment = shouldConsiderZoneResize
    ? adjustPolygonFlexZonesToFit(
        validationAction,
        currentEncounter,
        nextEncounter
      )
    : { nextEncounter, resizedZoneIds: [] };
  const shouldAutoResize =
    action.type === "zone.reshape" ||
    (isActorFootprintChange(action) &&
      currentEncounter.validationState.mode !== "STRICT" &&
      currentEncounter.validationState.mode !== "ASSISTED") ||
    action.type === "actor.create" ||
    action.type === "actor.move" ||
    action.type === "actor.moveMany";
  const requiresConfirmation =
    isActorFootprintChange(action) &&
    currentEncounter.validationState.mode === "ASSISTED" &&
    adjustment.resizedZoneIds.length > 0;
  const effectiveNextEncounter = shouldAutoResize || requiresConfirmation
    ? adjustment.nextEncounter
    : nextEncounter;
  const validationResult = runValidationPipeline({
    state: currentEncounter,
    nextState: effectiveNextEncounter,
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
    blocked: validationResult.blocked || requiresConfirmation,
    action: actionWithValidation,
    nextEncounter: {
      ...effectiveNextEncounter,
      validationState: {
        ...effectiveNextEncounter.validationState,
        mode: currentEncounter.validationState.mode,
        messages: validationResult.messages
      }
    },
    requiresConfirmation,
    validationResult
  };
}
