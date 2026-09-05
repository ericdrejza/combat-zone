import { useState } from "react";
import { useDispatch } from "react-redux";

import type { EncounterState } from "@core/encounter/types";
import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { setActiveTool } from "@interaction/interactionState";
import { createWebImageAsset } from "@library/webImageAsset";
import { commitEncounterChange } from "@store/encounterSlice";
import { useCanvasViewport } from "@ui/canvas/CanvasViewportContext";
import {
  getActiveBackgroundFitMode,
  canvasMatchesBackgroundFitMode,
  getBackgroundFitCanvasSize,
  getLogicalViewportSize,
  scaleCanvasSize,
  type BackgroundFitMode
} from "./backgroundSizing";
import {
  commitBackgroundImage,
  commitCanvasResize
} from "./backgroundCanvasActions";
import { readImageAssetDimensions } from "./readImageFile";

export function useBackgroundTool(encounter: EncounterState) {
  const dispatch = useDispatch();
  const { getViewportSize, viewportSize, zoom } = useCanvasViewport();
  const [preferredFitMode, setPreferredFitMode] =
    useState<BackgroundFitMode | null>("fit");

  async function addBackgroundFromUrl(url: string, name?: string) {
    const asset = createWebImageAsset(url);
    const nextBackgroundImage = await readImageAssetDimensions(
      name?.trim() ? { ...asset, name: name.trim() } : asset
    );
    setPreferredFitMode("fit");
    commitBackgroundImage({
      backgroundImage: nextBackgroundImage,
      dispatch,
      encounter,
      viewportSize: getViewportSize(),
      viewportZoom: zoom
    });
    dispatch(setActiveTool("zone"));
  }

  function deleteBackground() {
    if (!encounter.backgroundImage) {
      return;
    }

    dispatch(
      commitEncounterChange({
        action: createEncounterActionRecord("background.delete", {
          backgroundImageName: encounter.backgroundImage.name
        }),
        nextEncounter: {
          ...encounter,
          backgroundImage: null
        }
      })
    );
    setPreferredFitMode("fit");
  }

  function resizeBackground(mode: BackgroundFitMode) {
    setPreferredFitMode(mode);
    const currentViewportSize = getViewportSize();
    const availableSize =
      currentViewportSize.width > 0 && currentViewportSize.height > 0
        ? getLogicalViewportSize(currentViewportSize, zoom)
        : encounter.canvasSize;
    const requestedCanvasSize = getBackgroundFitCanvasSize(
      encounter.backgroundImage ?? encounter.canvasSize,
      availableSize,
      mode
    );
    commitCanvasResize({
      actionType: "canvas.resize",
      dispatch,
      encounter,
      payload: { mode },
      requestedCanvasSize
    });
  }

  function scaleBackground(scale: number) {
    setPreferredFitMode(null);
    commitCanvasResize({
      actionType: "canvas.resize",
      dispatch,
      encounter,
      payload: { scale },
      requestedCanvasSize: scaleCanvasSize(encounter.canvasSize, scale),
      requestedZoneScale: scale
    });
  }

  const availableSize =
    viewportSize.width > 0 && viewportSize.height > 0
      ? getLogicalViewportSize(viewportSize, zoom)
      : encounter.canvasSize;
  const aspectRatioSource = encounter.backgroundImage ?? encounter.canvasSize;
  const derivedFitMode = getActiveBackgroundFitMode(
    encounter.canvasSize,
    aspectRatioSource,
    availableSize
  );
  const activeFitMode =
    preferredFitMode &&
    canvasMatchesBackgroundFitMode(
      encounter.canvasSize,
      aspectRatioSource,
      availableSize,
      preferredFitMode
    )
      ? preferredFitMode
      : derivedFitMode;

  return {
    activeFitMode,
    addBackgroundFromUrl,
    deleteBackground,
    resizeBackground,
    scaleBackground
  };
}
