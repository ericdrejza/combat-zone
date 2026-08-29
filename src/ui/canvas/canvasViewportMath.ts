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
  return getZoomScrollAtPoint({
    canvasSize: input.canvasSize,
    currentZoom: input.currentZoom,
    nextZoom: input.nextZoom,
    scrollLeft: input.scrollLeft,
    scrollTop: input.scrollTop,
    viewportPoint: {
      x: input.viewportSize.width / 2,
      y: input.viewportSize.height / 2
    },
    viewportSize: input.viewportSize
  });
}

/**
 * Calculates scroll needed to keep a point under a viewport coordinate while
 * changing zoom. This is also the primitive used by two-finger pinch zoom.
 */
export function getZoomScrollAtPoint(input: {
  canvasPoint?: { x: number; y: number };
  canvasSize: CanvasSize;
  currentZoom: number;
  nextZoom: number;
  scrollLeft: number;
  scrollTop: number;
  viewportPoint: { x: number; y: number };
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
    x: input.canvasPoint?.x ??
      (input.scrollLeft + input.viewportPoint.x - oldOffset.x) /
        input.currentZoom,
    y: input.canvasPoint?.y ??
      (input.scrollTop + input.viewportPoint.y - oldOffset.y) /
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
      logicalCenter.x * input.nextZoom + newOffset.x - input.viewportPoint.x
    ),
    top: Math.max(
      0,
      logicalCenter.y * input.nextZoom + newOffset.y - input.viewportPoint.y
    )
  };
}

/** Returns the distance between two touch pointers. */
export function getPointerDistance(
  first: { x: number; y: number },
  second: { x: number; y: number }
): number {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

/** Returns the midpoint between two touch pointers. */
export function getPointerMidpoint(
  first: { x: number; y: number },
  second: { x: number; y: number }
): { x: number; y: number } {
  return {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2
  };
}

/** Keeps the same proportional canvas point centered through a canvas resize. */
export function getCenteredCanvasResizeScroll(input: {
  currentCanvasSize: CanvasSize;
  nextCanvasSize: CanvasSize;
  scrollLeft: number;
  scrollTop: number;
  viewportSize: CanvasSize;
  zoom: number;
}): { left: number; top: number } {
  const currentRenderedSize = {
    height: input.currentCanvasSize.height * input.zoom,
    width: input.currentCanvasSize.width * input.zoom
  };
  const nextRenderedSize = {
    height: input.nextCanvasSize.height * input.zoom,
    width: input.nextCanvasSize.width * input.zoom
  };
  const currentOffset = {
    x: Math.max(0, (input.viewportSize.width - currentRenderedSize.width) / 2),
    y: Math.max(0, (input.viewportSize.height - currentRenderedSize.height) / 2)
  };
  const centeredRatio = {
    x: Math.min(
      1,
      Math.max(
        0,
        (input.scrollLeft + input.viewportSize.width / 2 - currentOffset.x) /
          currentRenderedSize.width
      )
    ),
    y: Math.min(
      1,
      Math.max(
        0,
        (input.scrollTop + input.viewportSize.height / 2 - currentOffset.y) /
          currentRenderedSize.height
      )
    )
  };
  const nextOffset = {
    x: Math.max(0, (input.viewportSize.width - nextRenderedSize.width) / 2),
    y: Math.max(0, (input.viewportSize.height - nextRenderedSize.height) / 2)
  };

  return {
    left: Math.max(
      0,
      centeredRatio.x * nextRenderedSize.width +
        nextOffset.x -
        input.viewportSize.width / 2
    ),
    top: Math.max(
      0,
      centeredRatio.y * nextRenderedSize.height +
        nextOffset.y -
        input.viewportSize.height / 2
    )
  };
}
