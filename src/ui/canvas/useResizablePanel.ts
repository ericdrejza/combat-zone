import { useEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";

export const DEFAULT_PANEL_SIZE = {
  height: 240,
  width: 704
};

const MIN_PANEL_HEIGHT = 112;
const MIN_PANEL_WIDTH = 280;

type ResizeStart = {
  height: number;
  width: number;
  x: number;
  y: number;
};

export function useResizablePanel() {
  const [size, setSize] = useState(DEFAULT_PANEL_SIZE);
  const [isResizing, setIsResizing] = useState(false);
  const resizeStart = useRef<ResizeStart | null>(null);

  useEffect(() => {
    function handleMouseMove(event: globalThis.MouseEvent) {
      const start = resizeStart.current;

      if (!start) {
        return;
      }

      setSize({
        height: Math.max(MIN_PANEL_HEIGHT, start.height + event.clientY - start.y),
        width: Math.max(MIN_PANEL_WIDTH, start.width + event.clientX - start.x)
      });
    }

    function handleMouseUp() {
      resizeStart.current = null;
      setIsResizing(false);
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  function startResize(event: ReactMouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    resizeStart.current = {
      height: size.height,
      width: size.width,
      x: event.clientX,
      y: event.clientY
    };
    setIsResizing(true);
  }

  function resetSize() {
    resizeStart.current = null;
    setIsResizing(false);
    setSize(DEFAULT_PANEL_SIZE);
  }

  const isResized =
    size.width !== DEFAULT_PANEL_SIZE.width ||
    size.height !== DEFAULT_PANEL_SIZE.height;

  return {
    isResized,
    isResizing,
    resetSize,
    size,
    startResize
  };
}
