import type { EncounterState } from "../encounter/types";
import type { EncounterActionRecord } from "../history/types";
import {
  adjustPolygonFlexZonesToFit
} from "./polygonFlexPlacement";
import { isZoneLayoutChange } from "./polygonFlexZoneAdjustment";
import {
  runValidationPipeline,
  runValidationPipelineSync
} from "./pipeline";
import type {
  ValidationAction,
  ValidationPipelineResult,
  Validator
} from "./types";
import { prepareEncounterChangeInWorker } from "./validationWorkerClient";

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

export function prepareValidatedEncounterChangeForRuntime(
  input: PrepareValidatedEncounterChangeInput
): PreparedValidatedEncounterChange | Promise<PreparedValidatedEncounterChange> {
  return typeof Worker === "undefined"
    ? prepareValidatedEncounterChange(input)
    : prepareValidatedEncounterChangeAsync(input);
}

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
    action.type === "actor.moveMany" ||
    isZoneLayoutChange(action);
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
    action.type === "actor.moveMany" ||
    isZoneLayoutChange(action);
  const requiresConfirmation =
    isActorFootprintChange(action) &&
    currentEncounter.validationState.mode === "ASSISTED" &&
    adjustment.resizedZoneIds.length > 0;
  const effectiveNextEncounter = shouldAutoResize || requiresConfirmation
    ? adjustment.nextEncounter
    : nextEncounter;
  const validationResult = runValidationPipelineSync({
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

/** Async counterpart used by UI mutations so built-in validation can leave the UI thread. */
export async function prepareValidatedEncounterChangeAsync({
  currentEncounter,
  nextEncounter,
  action,
  validators
}: PrepareValidatedEncounterChangeInput): Promise<PreparedValidatedEncounterChange> {
  const workerPreparation = prepareEncounterChangeInWorker({
    currentEncounter,
    nextEncounter,
    action,
    validators
  });

  if (workerPreparation) {
    return workerPreparation;
  }

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
    action.type === "actor.moveMany" ||
    isZoneLayoutChange(action);
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
    action.type === "actor.moveMany" ||
    isZoneLayoutChange(action);
  const requiresConfirmation =
    isActorFootprintChange(action) &&
    currentEncounter.validationState.mode === "ASSISTED" &&
    adjustment.resizedZoneIds.length > 0;
  const effectiveNextEncounter = shouldAutoResize || requiresConfirmation
    ? adjustment.nextEncounter
    : nextEncounter;
  const validationResult = await runValidationPipeline({
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
