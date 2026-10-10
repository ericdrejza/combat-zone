import { getGridCoverage } from '@core/movement/gridCoverage';
import { type BackgroundResizeOverflowBehavior } from '@core/encounter/backgroundResizeOverflow';
import { readBackgroundResizeOverflowPreference } from '@ui/interface_preferences/InterfacePreferenceProvider';
import { clampCanvasResizeToValidLayout } from "@core/encounter/clampCanvasResize";
export { clampCanvasResizeToValidLayout } from "@core/encounter/clampCanvasResize";
import type { EncounterState } from "@core/encounter/types";
import type { EncounterBackgroundImage } from "@core/encounter/types";
import type { CanvasSize } from "@core/layout/polygonCanvasBounds";
import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import type { JsonObject } from "@core/history/types";
import { prepareValidatedEncounterChangeForRuntime } from "@core/validation/validatedEncounterChange";
import { commitEncounterChange } from "@store/encounterSlice";
import { logEncounterValidationBlock } from "@store/encounterLogSlice";
import type { AppDispatch } from "@store/store";
import {
  getBackgroundFitCanvasSize,
  getLogicalViewportSize
} from "./backgroundSizing";

type CanvasActionType =
  | "background.add"
  | "background.replace"
  | "canvas.resize";

type CommitCanvasResizeInput = {
  actionType: CanvasActionType;
  dispatch: AppDispatch;
  encounter: EncounterState;
  nextEncounterBase?: EncounterState;
  payload?: JsonObject;
  requestedCanvasSize: CanvasSize;
  requestedZoneScale?: number;
  overflowBehavior?: BackgroundResizeOverflowBehavior;
};

export function commitCanvasResize({
  actionType,
  dispatch,
  encounter,
  nextEncounterBase = encounter,
  payload = {},
  requestedCanvasSize,
  requestedZoneScale,
  overflowBehavior = readBackgroundResizeOverflowPreference()
}: CommitCanvasResizeInput): void {
  const coverage = getGridCoverage(encounter);
  const zoneScale =
    requestedZoneScale ??
    Math.min(
      requestedCanvasSize.width / coverage.width,
      requestedCanvasSize.height / coverage.height
    );
  const candidate = clampCanvasResizeToValidLayout(
    encounter,
    nextEncounterBase,
    requestedCanvasSize,
    zoneScale,
    actionType,
    overflowBehavior
  );
  const action = createEncounterActionRecord(actionType, {
    ...payload,
    canvasSize: candidate.canvasSize,
    zoneScale: candidate.zoneScale,
    overflowBehavior
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
  viewportZoom: number;
}): void {
  const actionType = input.encounter.backgroundImage
    ? "background.replace"
    : "background.add";
  const availableSize =
    input.viewportSize.width > 0 && input.viewportSize.height > 0
      ? getLogicalViewportSize(input.viewportSize, input.viewportZoom)
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
      gridCoverage: undefined,
      backgroundImage: { ...input.backgroundImage, frame: getGridCoverage(input.encounter) }
    },
    payload: { backgroundImage: input.backgroundImage },
    requestedCanvasSize
  });
}
