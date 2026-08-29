import {
  type PointerEvent,
  useRef
} from "react";

import type { LayoutPoint } from "@core/layout/types";
import type { CanvasSize } from "@core/layout/polygonCanvasBounds";
import {
  clampZoom,
  getPointerDistance,
  getPointerMidpoint
} from "./canvasViewportMath";

type TouchPoint = { x: number; y: number };

type TouchGestureViewport = {
  getViewportSize: () => CanvasSize;
  setZoomAtPoint: (
    requestedZoom: number,
    viewportPoint: LayoutPoint,
    canvasPoint?: LayoutPoint
  ) => void;
  zoom: number;
};

type PinchStart = {
  canvasPoint: TouchPoint;
  distance: number;
  zoom: number;
};

type CanvasTouchGestureInput = {
  canvasSize: CanvasSize;
  elementRef: { current: HTMLDivElement | null };
  viewport: TouchGestureViewport;
};

export const TOUCH_NAVIGATION_START_EVENT =
  "combat-zone:touch-navigation-start";

/**
 * Owns touch-only navigation so the viewport remains an orchestration
 * component. One finger is left available to the canvas editing surface;
 * two fingers pan and pinch without creating encounter mutations.
 */
export function useCanvasTouchGestures({
  canvasSize,
  elementRef,
  viewport
}: CanvasTouchGestureInput) {
  const touchPointsRef = useRef(new Map<number, TouchPoint>());
  const pinchStartRef = useRef<PinchStart | null>(null);
  const gestureSuppressedRef = useRef(false);

  function getViewportPoint(clientX: number, clientY: number): TouchPoint {
    const bounds = elementRef.current?.getBoundingClientRect();
    return {
      x: clientX - (bounds?.left ?? 0),
      y: clientY - (bounds?.top ?? 0)
    };
  }

  function getCanvasPoint(point: TouchPoint): TouchPoint {
    const element = elementRef.current;
    if (!element) return point;
    const viewportSize = viewport.getViewportSize();
    const offset = {
      x: Math.max(0, (viewportSize.width - canvasSize.width * viewport.zoom) / 2),
      y: Math.max(0, (viewportSize.height - canvasSize.height * viewport.zoom) / 2)
    };
    return {
      x: (element.scrollLeft + point.x - offset.x) / viewport.zoom,
      y: (element.scrollTop + point.y - offset.y) / viewport.zoom
    };
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "touch") return;
    touchPointsRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY
    });

    if (touchPointsRef.current.size === 1) return;

    if (touchPointsRef.current.size !== 2) return;
    window.dispatchEvent(new Event(TOUCH_NAVIGATION_START_EVENT));
    const points = [...touchPointsRef.current.values()];
    const midpoint = getPointerMidpoint(points[0], points[1]);
    const viewportPoint = getViewportPoint(midpoint.x, midpoint.y);
    pinchStartRef.current = {
      canvasPoint: getCanvasPoint(viewportPoint),
      distance: Math.max(1, getPointerDistance(points[0], points[1])),
      zoom: viewport.zoom
    };
    gestureSuppressedRef.current = true;
    event.preventDefault();
    event.stopPropagation();
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "touch") return;
    if (!touchPointsRef.current.has(event.pointerId)) return;
    touchPointsRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY
    });

    const pinchStart = pinchStartRef.current;
    if (!pinchStart || touchPointsRef.current.size < 2) return;
    const points = [...touchPointsRef.current.values()];
    const midpoint = getPointerMidpoint(points[0], points[1]);
    const nextZoom = clampZoom(
      pinchStart.zoom *
        (getPointerDistance(points[0], points[1]) / pinchStart.distance)
    );
    viewport.setZoomAtPoint(
      nextZoom,
      getViewportPoint(midpoint.x, midpoint.y),
      pinchStart.canvasPoint
    );
    event.preventDefault();
    event.stopPropagation();
  }

  function finishPointer(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "touch") return;
    if (gestureSuppressedRef.current) event.stopPropagation();
    touchPointsRef.current.delete(event.pointerId);
    if (touchPointsRef.current.size < 2) pinchStartRef.current = null;
    if (touchPointsRef.current.size === 0) {
      gestureSuppressedRef.current = false;
    }
  }

  return {
    handlePointerCancel: finishPointer,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp: finishPointer
  };
}
