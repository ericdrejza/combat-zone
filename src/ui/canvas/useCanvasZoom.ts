import { useCallback, useRef, useState } from 'react';
import type { CanvasSize } from '@core/layout/polygonCanvasBounds';
import type { LayoutPoint } from '@core/layout/types';
import { clampZoom, getCenteredZoomScroll, getZoomScrollAtPoint, MAX_CANVAS_ZOOM } from './canvasViewportMath';

/** Own zoom commands and temporary restoration independently of viewport measurement. */
export function useCanvasZoom({ canvasSize, viewportElement, getViewportSize }: {
  canvasSize: CanvasSize;
  viewportElement: HTMLDivElement | null;
  getViewportSize: () => CanvasSize;
}) {
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(zoom);
  const temporaryZoomRef = useRef<object | null>(null);
  zoomRef.current = zoom;

  const setCenteredZoom = useCallback(
    (requestedZoom: number) => {
      temporaryZoomRef.current = null;
      const nextZoom = clampZoom(requestedZoom);
      const currentZoom = zoomRef.current;
      const scroll = viewportElement
        ? getCenteredZoomScroll({
            canvasSize,
            currentZoom,
            nextZoom,
            scrollLeft: viewportElement.scrollLeft,
            scrollTop: viewportElement.scrollTop,
            viewportSize: getViewportSize()
          })
        : null;

      zoomRef.current = nextZoom;
      setZoom(nextZoom);
      if (viewportElement && scroll) {
        requestAnimationFrame(() => {
          viewportElement.scrollLeft = scroll.left;
          viewportElement.scrollTop = scroll.top;
        });
      }
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
      const scroll = viewportElement
        ? getZoomScrollAtPoint({
            canvasPoint,
            canvasSize,
            currentZoom,
            nextZoom,
            scrollLeft: viewportElement.scrollLeft,
            scrollTop: viewportElement.scrollTop,
            viewportPoint,
            viewportSize: getViewportSize()
          })
        : null;

      zoomRef.current = nextZoom;
      setZoom(nextZoom);
      if (viewportElement && scroll) {
        requestAnimationFrame(() => {
          viewportElement.scrollLeft = scroll.left;
          viewportElement.scrollTop = scroll.top;
        });
      }
    },
    [canvasSize, getViewportSize, viewportElement]
  );

  return { zoom, zoomRef, setCenteredZoom, setZoomAtPoint, beginTemporaryMaxZoom };
}
