import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { CanvasSize } from '@core/layout/polygonCanvasBounds';
import type { LayoutPoint } from '@core/layout/types';
import { CANVAS_ZOOM_STEP, clampZoom, getCenteredZoomScroll, getZoomScrollAtPoint, MAX_CANVAS_ZOOM } from './canvasViewportMath';

/** Own zoom commands and temporary restoration independently of viewport measurement. */
export function useCanvasZoom({ canvasSize, viewportElement, getViewportSize }: {
  canvasSize: CanvasSize;
  viewportElement: HTMLDivElement | null;
  getViewportSize: () => CanvasSize;
}) {
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(zoom);
  const committedZoomRef = useRef(zoom);
  const temporaryZoomRef = useRef<object | null>(null);
  const pendingScrollRef = useRef<{ element: HTMLDivElement; left: number; top: number } | null>(null);
  zoomRef.current = zoom;

  // React must resize the canvas before scrolling, but both must finish before paint.
  useLayoutEffect(() => {
    committedZoomRef.current = zoom;
    const pending = pendingScrollRef.current;
    pendingScrollRef.current = null;
    if (pending?.element === viewportElement) {
      viewportElement.scrollLeft = pending.left;
      viewportElement.scrollTop = pending.top;
    }
  }, [zoom, viewportElement]);

  const setCenteredZoom = useCallback(
    (requestedZoom: number) => {
      temporaryZoomRef.current = null;
      const nextZoom = clampZoom(requestedZoom);
      const currentZoom = zoomRef.current;
      if (nextZoom === currentZoom) return;
      const pending = pendingScrollRef.current;
      const scroll = viewportElement
        ? getCenteredZoomScroll({
            canvasSize,
            currentZoom,
            nextZoom,
            scrollLeft: pending?.element === viewportElement ? pending.left : viewportElement.scrollLeft,
            scrollTop: pending?.element === viewportElement ? pending.top : viewportElement.scrollTop,
            viewportSize: getViewportSize()
          })
        : null;

      if (viewportElement && scroll) {
        pendingScrollRef.current = { element: viewportElement, ...scroll };
      }
      zoomRef.current = nextZoom;
      setZoom(nextZoom);
    },
    [canvasSize, getViewportSize, viewportElement]
  );

  const beginTemporaryMaxZoom = useCallback(() => {
    const previousZoom = zoomRef.current;
    const lease = {};
    setCenteredZoom(MAX_CANVAS_ZOOM);
    temporaryZoomRef.current = lease;
    return () => {
      if (temporaryZoomRef.current === lease) setCenteredZoom(previousZoom);
    };
  }, [setCenteredZoom]);

  const setZoomAtPoint = useCallback(
    (
      requestedZoom: number,
      viewportPoint: LayoutPoint,
      canvasPoint?: LayoutPoint
    ) => {
      temporaryZoomRef.current = null;
      const nextZoom = clampZoom(requestedZoom);
      const currentZoom = zoomRef.current;
      if (nextZoom === currentZoom && !canvasPoint) return;
      const pending = pendingScrollRef.current;
      const scroll = viewportElement
        ? getZoomScrollAtPoint({
            canvasPoint,
            canvasSize,
            currentZoom,
            nextZoom,
            scrollLeft: pending?.element === viewportElement ? pending.left : viewportElement.scrollLeft,
            scrollTop: pending?.element === viewportElement ? pending.top : viewportElement.scrollTop,
            viewportPoint,
            viewportSize: getViewportSize()
          })
        : null;

      if (viewportElement && scroll) {
        if (nextZoom === currentZoom && nextZoom === committedZoomRef.current) {
          // A two-finger gesture can translate without changing its distance/zoom.
          pendingScrollRef.current = null;
          viewportElement.scrollLeft = scroll.left;
          viewportElement.scrollTop = scroll.top;
        } else pendingScrollRef.current = { element: viewportElement, ...scroll };
      }
      zoomRef.current = nextZoom;
      setZoom(nextZoom);
    },
    [canvasSize, getViewportSize, viewportElement]
  );

  const zoomByWheelAtPoint = useCallback((deltaY: number, viewportPoint: LayoutPoint) => {
    if (!deltaY) return;
    const direction = deltaY < 0 ? 1 : -1;
    setZoomAtPoint(zoomRef.current + direction * CANVAS_ZOOM_STEP, viewportPoint);
  }, [setZoomAtPoint]);

  return { zoom, zoomRef, setCenteredZoom, setZoomAtPoint, zoomByWheelAtPoint, beginTemporaryMaxZoom };
}
