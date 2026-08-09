import type { CanvasSize } from "@core/layout/polygonCanvasBounds";
import type { EncounterBackgroundImage } from "@core/encounter/types";

export type BackgroundFitMode = "fit" | "fit-height" | "fit-width";

function roundSize(size: CanvasSize): CanvasSize {
  return {
    height: Math.max(1, Math.round(size.height)),
    width: Math.max(1, Math.round(size.width))
  };
}

export function getBackgroundFitCanvasSize(
  image: Pick<EncounterBackgroundImage, "height" | "width">,
  viewport: CanvasSize,
  mode: BackgroundFitMode
): CanvasSize {
  if (image.width <= 0 || image.height <= 0) {
    return roundSize(viewport);
  }

  const widthScale = viewport.width / image.width;
  const heightScale = viewport.height / image.height;
  const scale =
    mode === "fit-width"
      ? widthScale
      : mode === "fit-height"
        ? heightScale
        : Math.min(widthScale, heightScale);

  return roundSize({
    height: image.height * scale,
    width: image.width * scale
  });
}

function sizesMatch(left: CanvasSize, right: CanvasSize): boolean {
  return (
    Math.abs(left.width - right.width) <= 1 &&
    Math.abs(left.height - right.height) <= 1
  );
}

export function canvasMatchesBackgroundFitMode(
  canvasSize: CanvasSize,
  image: EncounterBackgroundImage,
  viewport: CanvasSize,
  mode: BackgroundFitMode
): boolean {
  return sizesMatch(
    canvasSize,
    getBackgroundFitCanvasSize(image, viewport, mode)
  );
}

/** Equivalent fit-width/height results intentionally resolve to Fit. */
export function getActiveBackgroundFitMode(
  canvasSize: CanvasSize,
  image: EncounterBackgroundImage,
  viewport: CanvasSize
): BackgroundFitMode | null {
  const fit = getBackgroundFitCanvasSize(image, viewport, "fit");

  if (sizesMatch(canvasSize, fit)) {
    return "fit";
  }
  if (
    sizesMatch(
      canvasSize,
      getBackgroundFitCanvasSize(image, viewport, "fit-width")
    )
  ) {
    return "fit-width";
  }
  if (
    sizesMatch(
      canvasSize,
      getBackgroundFitCanvasSize(image, viewport, "fit-height")
    )
  ) {
    return "fit-height";
  }

  return null;
}

export function scaleCanvasSize(
  canvasSize: CanvasSize,
  scale: number
): CanvasSize {
  return roundSize({
    height: canvasSize.height * scale,
    width: canvasSize.width * scale
  });
}
