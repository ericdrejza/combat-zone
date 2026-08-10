import {
  type KeyboardEvent,
  type MouseEvent,
  type PropsWithChildren,
  type WheelEvent,
  useCallback,
  useEffect,
  useRef
} from "react";

import type { CanvasSize } from "@core/layout/polygonCanvasBounds";
import { useCanvasViewport } from "./CanvasViewportContext";

type PanStart = {
  clientX: number;
  clientY: number;
  scrollLeft: number;
  scrollTop: number;
};

type CanvasViewportProps = PropsWithChildren<{
  canvasSize: CanvasSize;
}>;

export function CanvasViewport({ canvasSize, children }: CanvasViewportProps) {
  const viewport = useCanvasViewport();
  const elementRef = useRef<HTMLDivElement | null>(null);
  const panStartRef = useRef<PanStart | null>(null);
  const pannedRef = useRef(false);
  const registerViewport = viewport.registerViewport;
  const setViewportRef = useCallback(
    (element: HTMLDivElement | null) => {
      elementRef.current = element;
      registerViewport(element);
    },
    [registerViewport]
  );

  useEffect(() => {
    return () => viewport.registerViewport(null);
  }, [viewport.registerViewport]);

  function handleMouseDown(event: MouseEvent<HTMLDivElement>) {
    const element = elementRef.current;
    if (!element || !viewport.panEnabled || event.button !== 2) return;

    panStartRef.current = {
      clientX: event.clientX,
      clientY: event.clientY,
      scrollLeft: element.scrollLeft,
      scrollTop: element.scrollTop
    };
    pannedRef.current = false;

    const handleMove = (moveEvent: globalThis.MouseEvent) => {
      const start = panStartRef.current;
      if (!start) return;

      const deltaX = moveEvent.clientX - start.clientX;
      const deltaY = moveEvent.clientY - start.clientY;
      if (Math.hypot(deltaX, deltaY) >= 2) pannedRef.current = true;
      element.scrollLeft = start.scrollLeft - deltaX;
      element.scrollTop = start.scrollTop - deltaY;
    };
    const handleUp = () => {
      panStartRef.current = null;
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  }

  function handleContextMenu(event: MouseEvent<HTMLDivElement>) {
    if (!pannedRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    pannedRef.current = false;
  }

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    if (!event.shiftKey || !elementRef.current) return;
    event.preventDefault();
    elementRef.current.scrollLeft += event.deltaY || event.deltaX;
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const amount = 40;
    const deltas: Record<string, [number, number]> = {
      ArrowDown: [0, amount],
      ArrowLeft: [-amount, 0],
      ArrowRight: [amount, 0],
      ArrowUp: [0, -amount]
    };
    const delta = deltas[event.key];
    if (!delta || !elementRef.current) return;

    event.preventDefault();
    elementRef.current.scrollLeft += delta[0];
    elementRef.current.scrollTop += delta[1];
  }

  const renderedSize = {
    height: canvasSize.height * viewport.zoom,
    width: canvasSize.width * viewport.zoom
  };
  const contentSize = {
    height: Math.max(viewport.viewportSize.height, renderedSize.height),
    width: Math.max(viewport.viewportSize.width, renderedSize.width)
  };

  return (
    <div
      ref={setViewportRef}
      aria-label="Canvas viewport"
      className={`scrollbar-hidden h-full w-full overflow-auto outline-none focus-visible:ring-2 focus-visible:ring-canvas-ink ${
        panStartRef.current ? "cursor-grabbing" : ""
      }`}
      data-canvas-zoom={viewport.zoom}
      onContextMenuCapture={handleContextMenu}
      onKeyDown={handleKeyDown}
      onMouseDown={handleMouseDown}
      onWheel={handleWheel}
      tabIndex={0}
    >
      <div
        className="relative"
        style={{ height: contentSize.height, width: contentSize.width }}
      >
        <div
          className="absolute"
          style={{
            height: renderedSize.height,
            left: Math.max(0, (contentSize.width - renderedSize.width) / 2),
            top: Math.max(0, (contentSize.height - renderedSize.height) / 2),
            width: renderedSize.width
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
