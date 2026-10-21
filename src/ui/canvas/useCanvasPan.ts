import { animate } from "motion/react";
import { useCallback, useEffect, useRef, type MutableRefObject } from "react";
import type { LayoutPoint } from "@core/layout/types";
import type { CanvasSize } from "@core/layout/polygonCanvasBounds";
import { useMotionPreference } from "@ui/motion_preferences/MotionPreferenceProvider";
import { getZoomScrollAtPoint } from "./canvasViewportMath";

/** Animate only requested navigation, yielding immediately to manual viewport input. */
export function useCanvasPan({ viewportElement, canvasSize, getViewportSize, zoom, zoomRef }: {
  viewportElement: HTMLDivElement | null; canvasSize: CanvasSize;
  getViewportSize: () => CanvasSize; zoom: number; zoomRef: MutableRefObject<number>;
}) {
  const { animationsDisabled } = useMotionPreference();
  const animation = useRef<{ stop: () => void } | null>(null);
  const stopPan = useCallback(() => { animation.current?.stop(); animation.current = null; }, []);
  useEffect(() => {
    if (!viewportElement) return;
    viewportElement.addEventListener("wheel", stopPan, { passive: true });
    viewportElement.addEventListener("pointerdown", stopPan, true);
    viewportElement.addEventListener("keydown", stopPan, true);
    return () => {
      stopPan();
      viewportElement.removeEventListener("wheel", stopPan);
      viewportElement.removeEventListener("pointerdown", stopPan, true);
      viewportElement.removeEventListener("keydown", stopPan, true);
    };
  }, [viewportElement, zoom, canvasSize.width, canvasSize.height, animationsDisabled, getViewportSize, stopPan]);

  const panToPoint = useCallback((canvasPoint: LayoutPoint, options?: { animate?: boolean }) => {
    stopPan();
    if (!viewportElement) return;
    const size = getViewportSize();
    const start = { left: viewportElement.scrollLeft, top: viewportElement.scrollTop };
    const scroll = getZoomScrollAtPoint({ canvasPoint, canvasSize,
      currentZoom: zoomRef.current, nextZoom: zoomRef.current,
      scrollLeft: start.left, scrollTop: start.top,
      viewportPoint: { x: size.width / 2, y: size.height / 2 }, viewportSize: size });
    const target = {
      left: Math.min(scroll.left, Math.max(0, canvasSize.width * zoomRef.current - size.width)),
      top: Math.min(scroll.top, Math.max(0, canvasSize.height * zoomRef.current - size.height))
    };
    const update = (progress: number) => {
      viewportElement.scrollLeft = start.left + (target.left - start.left) * progress;
      viewportElement.scrollTop = start.top + (target.top - start.top) * progress;
    };
    if (!options?.animate || animationsDisabled || Math.hypot(target.left - start.left, target.top - start.top) < 1) {
      update(1);
      return;
    }
    animation.current = animate(0, 1, { duration: 0.35, ease: "easeInOut", onUpdate: update });
  }, [viewportElement, canvasSize, getViewportSize, zoomRef, animationsDisabled, stopPan]);
  return { panToPoint, stopPan };
}
