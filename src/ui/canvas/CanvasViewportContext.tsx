import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
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
  zoomToFit: () => void;
};

const CanvasViewportContext = createContext<CanvasViewportValue | null>(null);

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
  const pendingFitRef = useRef(true);
  zoomRef.current = zoom;

  useEffect(() => {
    if (!viewportElement) return;

    const measure = () =>
      setViewportSize((current) => {
        const bounds = viewportElement.getBoundingClientRect();
        const next = {
          height: bounds.height || viewportElement.clientHeight,
          width: bounds.width || viewportElement.clientWidth
        };
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
            viewportSize: {
              height: viewportElement.clientHeight || viewportSize.height,
              width: viewportElement.clientWidth || viewportSize.width
            }
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

  useEffect(() => {
    const previous = previousDocumentRef.current;
    previousDocumentRef.current = { canvasSize, encounterId };

    if (previous.encounterId !== encounterId) {
      pendingFitRef.current = true;
      return;
    }
    if (
      previous.canvasSize.width !== canvasSize.width ||
      previous.canvasSize.height !== canvasSize.height
    ) {
      pendingFitRef.current = false;
      setCenteredZoom(1);
    }
  }, [canvasSize, encounterId, setCenteredZoom]);

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
