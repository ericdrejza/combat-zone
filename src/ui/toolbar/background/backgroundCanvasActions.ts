import { resizeEncounterCanvas } from "@core/encounter/canvasSizeMutations";
import type { EncounterState } from "@core/encounter/types";
import type { EncounterBackgroundImage } from "@core/encounter/types";
import type { CanvasSize } from "@core/layout/polygonCanvasBounds";
import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import type { JsonObject } from "@core/history/types";
import { runValidationPipelineSync } from "@core/validation/pipeline";
import { prepareValidatedEncounterChangeForRuntime } from "@core/validation/validatedEncounterChange";
import { commitEncounterChange } from "@store/encounterSlice";
import { logEncounterValidationBlock } from "@store/encounterLogSlice";
import type { AppDispatch } from "@store/store";
import { getBackgroundFitCanvasSize } from "./backgroundSizing";

type CanvasActionType =
  | "background.add"
  | "background.replace"
  | "canvas.resize";

type ResizeCandidate = {
  canvasSize: CanvasSize;
  encounter: EncounterState;
  zoneScale: number;
};

type CommitCanvasResizeInput = {
  actionType: CanvasActionType;
  dispatch: AppDispatch;
  encounter: EncounterState;
  nextEncounterBase?: EncounterState;
  payload?: JsonObject;
  requestedCanvasSize: CanvasSize;
  requestedZoneScale?: number;
};

function createCandidate(
  encounter: EncounterState,
  canvasSize: CanvasSize,
  zoneScale: number
): ResizeCandidate {
  return {
    canvasSize,
    encounter: resizeEncounterCanvas(encounter, { canvasSize, zoneScale }),
    zoneScale
  };
}

function candidateIsValid(
  currentEncounter: EncounterState,
  candidate: ResizeCandidate,
  actionType: CanvasActionType
): boolean {
  return runValidationPipelineSync({
    action: { type: actionType, payload: {} },
    nextState: candidate.encounter,
    state: currentEncounter
  }).valid;
}

/** Finds the closest larger uniform scale that preserves all derived layouts. */
export function clampCanvasResizeToValidLayout(
  currentEncounter: EncounterState,
  encounterWithChanges: EncounterState,
  requestedCanvasSize: CanvasSize,
  requestedZoneScale: number,
  actionType: CanvasActionType
): ResizeCandidate {
  const requested = createCandidate(
    encounterWithChanges,
    requestedCanvasSize,
    requestedZoneScale
  );

  if (candidateIsValid(currentEncounter, requested, actionType)) {
    return requested;
  }

  let invalidFactor = 1;
  let validFactor = 1.1;
  let validCandidate = requested;

  for (let attempt = 0; attempt < 40; attempt += 1) {
    validCandidate = createCandidate(
      encounterWithChanges,
      {
        height: Math.round(requestedCanvasSize.height * validFactor),
        width: Math.round(requestedCanvasSize.width * validFactor)
      },
      requestedZoneScale * validFactor
    );

    if (candidateIsValid(currentEncounter, validCandidate, actionType)) {
      break;
    }

    invalidFactor = validFactor;
    validFactor *= 1.25;
  }

  for (let iteration = 0; iteration < 18; iteration += 1) {
    const factor = (invalidFactor + validFactor) / 2;
    const candidate = createCandidate(
      encounterWithChanges,
      {
        height: Math.round(requestedCanvasSize.height * factor),
        width: Math.round(requestedCanvasSize.width * factor)
      },
      requestedZoneScale * factor
    );

    if (candidateIsValid(currentEncounter, candidate, actionType)) {
      validFactor = factor;
      validCandidate = candidate;
    } else {
      invalidFactor = factor;
    }
  }

  return validCandidate;
}

export function commitCanvasResize({
  actionType,
  dispatch,
  encounter,
  nextEncounterBase = encounter,
  payload = {},
  requestedCanvasSize,
  requestedZoneScale
}: CommitCanvasResizeInput): void {
  const zoneScale =
    requestedZoneScale ??
    Math.min(
      requestedCanvasSize.width / encounter.canvasSize.width,
      requestedCanvasSize.height / encounter.canvasSize.height
    );
  const candidate = clampCanvasResizeToValidLayout(
    encounter,
    nextEncounterBase,
    requestedCanvasSize,
    zoneScale,
    actionType
  );
  const action = createEncounterActionRecord(actionType, {
    ...payload,
    canvasSize: candidate.canvasSize,
    zoneScale: candidate.zoneScale
  });
  const prepared = prepareValidatedEncounterChangeForRuntime({
    action,
    currentEncounter: encounter,
    nextEncounter: candidate.encounter
  });
  const commitPrepared = (resolved: Awaited<typeof prepared>) => {
    if (logEncounterValidationBlock(dispatch, resolved)) {
      return;
    }
    if (!resolved.blocked) {
      dispatch(
        commitEncounterChange({
          action: resolved.action,
          nextEncounter: resolved.nextEncounter
        })
      );
    }
  };

  if (prepared instanceof Promise) {
    void prepared.then(commitPrepared);
  } else {
    commitPrepared(prepared);
  }
}

export function commitBackgroundImage(input: {
  backgroundImage: EncounterBackgroundImage;
  dispatch: AppDispatch;
  encounter: EncounterState;
  viewportSize: CanvasSize;
}): void {
  const actionType = input.encounter.backgroundImage
    ? "background.replace"
    : "background.add";
  const availableSize =
    input.viewportSize.width > 0 && input.viewportSize.height > 0
      ? input.viewportSize
      : input.encounter.canvasSize;
  const requestedCanvasSize = getBackgroundFitCanvasSize(
    input.backgroundImage,
    availableSize,
    "fit"
  );

  commitCanvasResize({
    actionType,
    dispatch: input.dispatch,
    encounter: input.encounter,
    nextEncounterBase: {
      ...input.encounter,
      backgroundImage: input.backgroundImage
    },
    payload: { backgroundImage: input.backgroundImage },
    requestedCanvasSize
  });
}
