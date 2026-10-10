import type { EncounterState } from './types';
import type { CanvasSize } from '@core/layout/polygonCanvasBounds';
import { resizeEncounterCanvas } from './canvasSizeMutations';
import { overflowingSpatialActorIds, unplaceOverflowingSpatialActors, type BackgroundResizeOverflowBehavior } from './backgroundResizeOverflow';
import { runValidationPipelineSync } from '@core/validation/pipeline';

type ResizeCandidate = { canvasSize: CanvasSize; encounter: EncounterState; zoneScale: number };

function createCandidate(
  encounter: EncounterState,
  canvasSize: CanvasSize,
  zoneScale: number,
  overflowBehavior: BackgroundResizeOverflowBehavior,
  finalize: (state: EncounterState) => EncounterState
): ResizeCandidate {
  const candidate = finalize(resizeEncounterCanvas(encounter, { canvasSize, zoneScale, overflowBehavior: 'clamp' }));
  const resized = overflowBehavior === 'zoneless' ? unplaceOverflowingSpatialActors(candidate) : candidate;
  return {
    canvasSize: resized.canvasSize,
    encounter: resized,
    zoneScale
  };
}

function candidateIsValid(
  currentEncounter: EncounterState,
  candidate: ResizeCandidate,
  actionType: string
): boolean {
  if (overflowingSpatialActorIds(candidate.encounter).length) return false;
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
  actionType: string,
  overflowBehavior: BackgroundResizeOverflowBehavior = 'clamp',
  finalize: (state: EncounterState) => EncounterState = state => state
): ResizeCandidate {
  const requested = createCandidate(
    encounterWithChanges,
    requestedCanvasSize,
    requestedZoneScale,
    overflowBehavior,
    finalize
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
      requestedZoneScale * validFactor,
      overflowBehavior,
      finalize
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
      requestedZoneScale * factor,
      overflowBehavior,
      finalize
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

