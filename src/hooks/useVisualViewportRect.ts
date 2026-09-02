import { useEffect, useState } from "react";

export type VisualViewportRect = {
  height: number;
  offsetLeft: number;
  offsetTop: number;
  width: number;
};

function readLayoutViewportRect(): VisualViewportRect {
  const documentElement = document.documentElement;

  return {
    height: documentElement.clientHeight || window.innerHeight,
    offsetLeft: 0,
    offsetTop: 0,
    width: documentElement.clientWidth || window.innerWidth
  };
}

/** Reads the screen area the browser is actually exposing to the application. */
export function readVisualViewportRect(): VisualViewportRect {
  const viewport = window.visualViewport;

  if (!viewport) {
    return readLayoutViewportRect();
  }

  return {
    height: viewport.height,
    offsetLeft: viewport.offsetLeft,
    offsetTop: viewport.offsetTop,
    width: viewport.width
  };
}

function rectsMatch(
  current: VisualViewportRect,
  next: VisualViewportRect
): boolean {
  return (
    current.height === next.height &&
    current.offsetLeft === next.offsetLeft &&
    current.offsetTop === next.offsetTop &&
    current.width === next.width
  );
}

/** Tracks browser chrome, orientation, and virtual-keyboard viewport changes. */
export function useVisualViewportRect(): VisualViewportRect {
  const [rect, setRect] = useState(readVisualViewportRect);

  useEffect(() => {
    const viewport = window.visualViewport;
    let frameId: number | null = null;

    const update = () => {
      frameId = null;
      const next = readVisualViewportRect();
      setRect((current) => (rectsMatch(current, next) ? current : next));
    };
    const scheduleUpdate = () => {
      if (frameId !== null) return;
      frameId = window.requestAnimationFrame(update);
    };

    update();
    viewport?.addEventListener("resize", scheduleUpdate);
    viewport?.addEventListener("scroll", scheduleUpdate);
    viewport?.addEventListener("scrollend", scheduleUpdate);
    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("orientationchange", scheduleUpdate);
    window.addEventListener("pageshow", scheduleUpdate);

    return () => {
      viewport?.removeEventListener("resize", scheduleUpdate);
      viewport?.removeEventListener("scroll", scheduleUpdate);
      viewport?.removeEventListener("scrollend", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("orientationchange", scheduleUpdate);
      window.removeEventListener("pageshow", scheduleUpdate);
      if (frameId !== null) window.cancelAnimationFrame(frameId);
    };
  }, []);

  return rect;
}
