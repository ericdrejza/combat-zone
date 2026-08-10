import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { useSelector } from "react-redux";

import type { CanvasSize } from "@core/layout/polygonCanvasBounds";
import type { RootState } from "@store/store";
import {
  CANVAS_ZOOM_STEP,
  clampZoom,
  getCenteredCanvasResizeScroll,
  getCenteredZoomScroll,
  getZoomToFit
} from "./canvasViewportMath";

type CanvasViewportValue = {
  panEnabled: boolean;
  registerViewport: (element: HTMLDivElement | null) => void;
  setPanEnabled: (enabled: boolean) => void;
  viewportSize: CanvasSize;
  zoom: number;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  zoomToFit: () => void;
};

const CanvasViewportContext = createContext<CanvasViewportValue | null>(null);

function readViewportSize(
  element: HTMLDivElement,
  fallback: CanvasSize
): CanvasSize {
  const bounds = element.getBoundingClientRect();
  return {
    height: element.clientHeight || bounds.height || fallback.height,
    width: element.clientWidth || bounds.width || fallback.width
  };
}

export function CanvasViewportProvider({ children }: PropsWithChildren) {
  const encounterId = useSelector(
    (state: RootState) => state.encounter.present.id
  );
  const canvasSize = useSelector(
    (state: RootState) => state.encounter.present.canvasSize
  );
  const [panEnabled, setPanEnabled] = useState(true);
  const [viewportElement, setViewportElement] =
    useState<HTMLDivElement | null>(null);
  const [viewportSize, setViewportSize] = useState<CanvasSize>({
    height: 0,
    width: 0
  });
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(zoom);
  const previousDocumentRef = useRef({ canvasSize, encounterId });
  const pendingResizeRef = useRef<{
    currentCanvasSize: CanvasSize;
    nextCanvasSize: CanvasSize;
    scrollLeft: number;
    scrollTop: number;
    viewportSize: CanvasSize;
    zoom: number;
  } | null>(null);
  const pendingFitRef = useRef(true);
  zoomRef.current = zoom;

  const previousDocument = previousDocumentRef.current;
  const encounterChanged = previousDocument.encounterId !== encounterId;
  const canvasChanged =
    previousDocument.canvasSize.width !== canvasSize.width ||
    previousDocument.canvasSize.height !== canvasSize.height;
  if (encounterChanged) {
    pendingFitRef.current = true;
    pendingResizeRef.current = null;
  } else if (canvasChanged && viewportElement) {
    pendingFitRef.current = false;
    pendingResizeRef.current = {
      currentCanvasSize: previousDocument.canvasSize,
      nextCanvasSize: canvasSize,
      scrollLeft: viewportElement.scrollLeft,
      scrollTop: viewportElement.scrollTop,
      viewportSize: readViewportSize(viewportElement, viewportSize),
      zoom: zoomRef.current
    };
  }
  previousDocumentRef.current = { canvasSize, encounterId };

  useEffect(() => {
    if (!viewportElement) return;

    const measure = () =>
      setViewportSize((current) => {
        const next = readViewportSize(viewportElement, current);
        return current.height === next.height && current.width === next.width
          ? current
          : next;
      });
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(viewportElement);

    return () => observer.disconnect();
  }, [viewportElement]);

  const setCenteredZoom = useCallback(
    (requestedZoom: number) => {
      const nextZoom = clampZoom(requestedZoom);
      const currentZoom = zoomRef.current;
      const scroll = viewportElement
        ? getCenteredZoomScroll({
            canvasSize,
            currentZoom,
            nextZoom,
            scrollLeft: viewportElement.scrollLeft,
            scrollTop: viewportElement.scrollTop,
            viewportSize: readViewportSize(viewportElement, viewportSize)
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
    [canvasSize, viewportElement, viewportSize]
  );

  const zoomToFit = useCallback(
    () => setCenteredZoom(getZoomToFit(canvasSize, viewportSize)),
    [canvasSize, setCenteredZoom, viewportSize]
  );

  useLayoutEffect(() => {
    const pendingResize = pendingResizeRef.current;
    if (!pendingResize || !viewportElement) return;

    pendingResizeRef.current = null;
    const scroll = getCenteredCanvasResizeScroll(pendingResize);
    viewportElement.scrollLeft = scroll.left;
    viewportElement.scrollTop = scroll.top;
  }, [canvasSize, viewportElement]);

  useEffect(() => {
    if (
      !pendingFitRef.current ||
      viewportSize.width <= 0 ||
      viewportSize.height <= 0
    ) {
      return;
    }

    pendingFitRef.current = false;
    setCenteredZoom(getZoomToFit(canvasSize, viewportSize));
  }, [canvasSize, setCenteredZoom, viewportSize]);

  const value = useMemo<CanvasViewportValue>(
    () => ({
      panEnabled,
      registerViewport: setViewportElement,
      resetZoom: () => setCenteredZoom(1),
      setPanEnabled,
      viewportSize,
      zoom,
      zoomIn: () => setCenteredZoom(zoomRef.current + CANVAS_ZOOM_STEP),
      zoomOut: () => setCenteredZoom(zoomRef.current - CANVAS_ZOOM_STEP),
      zoomToFit
    }),
    [panEnabled, setCenteredZoom, viewportSize, zoom, zoomToFit]
  );

  return (
    <CanvasViewportContext.Provider value={value}>
      {children}
    </CanvasViewportContext.Provider>
  );
}

export function useCanvasViewport(): CanvasViewportValue {
  const value = useContext(CanvasViewportContext);
  if (!value) {
    throw new Error("useCanvasViewport must be used within CanvasViewportProvider.");
  }
  return value;
}
