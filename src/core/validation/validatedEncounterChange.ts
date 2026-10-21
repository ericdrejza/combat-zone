import { reconcileZoneVertices } from '@core/movement/zoneVertexSnapping';
import { isSpatial } from '@core/movement/movementStrategies';
import { resizeSpatialActors } from '@core/movement/actorResizePivot';
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
  nextEncounter = reconcileZoneVertices(nextEncounter);
  const validationAction: ValidationAction = {
    type: action.type,
    payload: action.payload
  };
  if (isActorFootprintChange(action)) nextEncounter = resizeSpatialActors(nextEncounter, currentEncounter);
  const adjustment = isSpatial(nextEncounter) ? { nextEncounter, resizedZoneIds: [] } : adjustPolygonFlexZonesToFit(
    validationAction,
    currentEncounter,
    nextEncounter
  );
  const shouldAutoResize =
    action.type === "zone.reshape" ||
    (isActorFootprintChange(action) &&
      currentEncounter.validationState.mode !== "STRICT" &&
      currentEncounter.validationState.mode !== "ASSISTED") ||
    action.type === "actor.create" ||
    action.type === "actor.duplicate" ||
    action.type === "actor.move" ||
    action.type === "actor.moveMany" ||
    isZoneLayoutChange(action) ||
    (!isActorFootprintChange(action) && adjustment.resizedZoneIds.length > 0);
  const requiresConfirmation =
    isActorFootprintChange(action) &&
    currentEncounter.validationState.mode === "ASSISTED" &&
    adjustment.resizedZoneIds.length > 0;
  const effectiveNextEncounter = reconcileZoneVertices(shouldAutoResize || requiresConfirmation
    ? adjustment.nextEncounter
    : nextEncounter);
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
  try {
    const workerPreparation = prepareEncounterChangeInWorker({
      currentEncounter,
      nextEncounter,
      action,
      validators
    });
    if (workerPreparation) return await workerPreparation;
  } catch {
    // Worker startup and runtime failures must preserve validation and mutations.
    return prepareValidatedEncounterChange({ currentEncounter, nextEncounter, action, validators });
  }

  nextEncounter = reconcileZoneVertices(nextEncounter);
  const validationAction: ValidationAction = {
    type: action.type,
    payload: action.payload
  };
  if (isActorFootprintChange(action)) nextEncounter = resizeSpatialActors(nextEncounter, currentEncounter);
  const adjustment = isSpatial(nextEncounter) ? { nextEncounter, resizedZoneIds: [] } : adjustPolygonFlexZonesToFit(
    validationAction,
    currentEncounter,
    nextEncounter
  );
  const shouldAutoResize =
    action.type === "zone.reshape" ||
    (isActorFootprintChange(action) &&
      currentEncounter.validationState.mode !== "STRICT" &&
      currentEncounter.validationState.mode !== "ASSISTED") ||
    action.type === "actor.create" ||
    action.type === "actor.duplicate" ||
    action.type === "actor.move" ||
    action.type === "actor.moveMany" ||
    isZoneLayoutChange(action) ||
    (!isActorFootprintChange(action) && adjustment.resizedZoneIds.length > 0);
  const requiresConfirmation =
    isActorFootprintChange(action) &&
    currentEncounter.validationState.mode === "ASSISTED" &&
    adjustment.resizedZoneIds.length > 0;
  const effectiveNextEncounter = reconcileZoneVertices(shouldAutoResize || requiresConfirmation
    ? adjustment.nextEncounter
    : nextEncounter);
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
