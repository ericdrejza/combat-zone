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
import type { LayoutPoint } from "@core/layout/types";
import type { RootState } from "@store/store";
import { useInterfacePreferences } from "@ui/interface_preferences/InterfacePreferenceProvider";
import {
  CANVAS_ZOOM_STEP,
  clampZoom,
  getCenteredCanvasResizeScroll,
  getCenteredZoomScroll,
  getZoomScrollAtPoint,
  getZoomToFit
} from "./canvasViewportMath";

type CanvasViewportValue = {
  getViewportSize: () => CanvasSize;
  panEnabled: boolean;
  registerViewport: (element: HTMLDivElement | null) => void;
  viewportSize: CanvasSize;
  zoom: number;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  /** Changes zoom while preserving a canvas point under a viewport point. */
  setZoomAtPoint: (
    requestedZoom: number,
    viewportPoint: LayoutPoint,
    canvasPoint?: LayoutPoint
  ) => void;
  zoomToFit: () => void;
  zoomToFitHeight: () => void;
  zoomToFitWidth: () => void;
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
  const { panWithRightClickDrag } = useInterfacePreferences();
  const encounterId = useSelector(
    (state: RootState) => state.encounter.present.id
  );
  const canvasSize = useSelector(
    (state: RootState) => state.encounter.present.canvasSize
  );
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
  const pendingManualFitFrameRef = useRef<number | null>(null);
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

  useEffect(
    () => () => {
      if (pendingManualFitFrameRef.current !== null) {
        cancelAnimationFrame(pendingManualFitFrameRef.current);
      }
    },
    []
  );

  /** Reads layout synchronously so commands do not depend on observer timing. */
  const getViewportSize = useCallback(
    () =>
      viewportElement
        ? readViewportSize(viewportElement, viewportSize)
        : viewportSize,
    [viewportElement, viewportSize]
  );

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

  const setZoomAtPoint = useCallback(
    (
      requestedZoom: number,
      viewportPoint: LayoutPoint,
      canvasPoint?: LayoutPoint
    ) => {
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

  const zoomToFit = useCallback(
    () => {
      const fitCurrentViewport = () => {
        const currentViewportSize = getViewportSize();
        setViewportSize((current) =>
          current.height === currentViewportSize.height &&
          current.width === currentViewportSize.width
            ? current
            : currentViewportSize
        );
        setCenteredZoom(getZoomToFit(canvasSize, currentViewportSize));
      };

      // Read synchronously for immediate feedback, then re-read after the
      // browser finishes any responsive reflow caused by the current frame.
      fitCurrentViewport();
      if (pendingManualFitFrameRef.current !== null) {
        cancelAnimationFrame(pendingManualFitFrameRef.current);
      }
      pendingManualFitFrameRef.current = requestAnimationFrame(() => {
        pendingManualFitFrameRef.current = null;
        fitCurrentViewport();
      });
    },
    [canvasSize, getViewportSize, setCenteredZoom]
  );

  const zoomToFitAxis = useCallback(
    (axis: "height" | "width") => {
      const currentViewportSize = getViewportSize();
      const canvasLength = canvasSize[axis];
      const viewportLength = currentViewportSize[axis];
      setCenteredZoom(
        canvasLength > 0 && viewportLength > 0
          ? viewportLength / canvasLength
          : 1
      );
    },
    [canvasSize, getViewportSize, setCenteredZoom]
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
      getViewportSize,
      panEnabled: panWithRightClickDrag,
      registerViewport: setViewportElement,
      resetZoom: () => setCenteredZoom(1),
      setZoomAtPoint,
      viewportSize,
      zoom,
      zoomIn: () => setCenteredZoom(zoomRef.current + CANVAS_ZOOM_STEP),
      zoomOut: () => setCenteredZoom(zoomRef.current - CANVAS_ZOOM_STEP),
      zoomToFit,
      zoomToFitHeight: () => zoomToFitAxis("height"),
      zoomToFitWidth: () => zoomToFitAxis("width")
    }),
    [
      getViewportSize,
      panWithRightClickDrag,
      setCenteredZoom,
      setZoomAtPoint,
      viewportSize,
      zoom,
      zoomToFit,
      zoomToFitAxis
    ]
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
