import type { CanvasSize } from "@core/layout/polygonCanvasBounds";

export const MIN_CANVAS_ZOOM = 0.2;
export const MAX_CANVAS_ZOOM = 4;
export const CANVAS_ZOOM_STEP = 0.1;

export function clampZoom(zoom: number): number {
  return (
    Math.round(
      Math.min(MAX_CANVAS_ZOOM, Math.max(MIN_CANVAS_ZOOM, zoom)) * 1000
    ) / 1000
  );
}

export function getZoomToFit(
  canvasSize: CanvasSize,
  viewportSize: CanvasSize
): number {
  if (
    canvasSize.width <= 0 ||
    canvasSize.height <= 0 ||
    viewportSize.width <= 0 ||
    viewportSize.height <= 0
  ) {
    return 1;
  }

  return clampZoom(
    Math.min(
      viewportSize.width / canvasSize.width,
      viewportSize.height / canvasSize.height
    )
  );
}

export function getCenteredZoomScroll(input: {
  canvasSize: CanvasSize;
  currentZoom: number;
  nextZoom: number;
  scrollLeft: number;
  scrollTop: number;
  viewportSize: CanvasSize;
}): { left: number; top: number } {
  const oldOffset = {
    x: Math.max(
      0,
      (input.viewportSize.width - input.canvasSize.width * input.currentZoom) / 2
    ),
    y: Math.max(
      0,
      (input.viewportSize.height - input.canvasSize.height * input.currentZoom) / 2
    )
  };
  const logicalCenter = {
    x:
      (input.scrollLeft + input.viewportSize.width / 2 - oldOffset.x) /
      input.currentZoom,
    y:
      (input.scrollTop + input.viewportSize.height / 2 - oldOffset.y) /
      input.currentZoom
  };
  const newOffset = {
    x: Math.max(
      0,
      (input.viewportSize.width - input.canvasSize.width * input.nextZoom) / 2
    ),
    y: Math.max(
      0,
      (input.viewportSize.height - input.canvasSize.height * input.nextZoom) / 2
    )
  };

  return {
    left: Math.max(
      0,
      logicalCenter.x * input.nextZoom + newOffset.x - input.viewportSize.width / 2
    ),
    top: Math.max(
      0,
      logicalCenter.y * input.nextZoom + newOffset.y - input.viewportSize.height / 2
    )
  };
}
