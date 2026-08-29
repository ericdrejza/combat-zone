import {
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type PropsWithChildren,
  type WheelEvent,
  useCallback,
  useRef
} from "react";

import type { CanvasSize } from "@core/layout/polygonCanvasBounds";
import { useCanvasViewport } from "./CanvasViewportContext";
import { useCanvasTouchGestures } from "./useCanvasTouchGestures";

type PanStart = {
  clientX: number;
  clientY: number;
  pointerId?: number;
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
  const touchGestures = useCanvasTouchGestures({
    canvasSize,
    elementRef,
    viewport
  });

  function handleMouseDown(event: MouseEvent<HTMLDivElement>) {
    const element = elementRef.current;
    if (
      !element ||
      !viewport.panEnabled ||
      event.button !== 2 ||
      panStartRef.current
    ) return;

    startMousePan(event.clientX, event.clientY);
  }

  function startMousePan(clientX: number, clientY: number, pointerId?: number) {
    const element = elementRef.current;
    if (!element || !viewport.panEnabled) return;

    panStartRef.current = {
      clientX,
      clientY,
      pointerId,
      scrollLeft: element.scrollLeft,
      scrollTop: element.scrollTop
    };
    pannedRef.current = false;

    const handleMove = (moveEvent: Pick<globalThis.MouseEvent, "clientX" | "clientY">) => {
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
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    if (pointerId !== undefined) {
      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp);
      window.addEventListener("pointercancel", handleUp);
    }
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch") return;

    if (
      event.pointerType === "mouse" &&
      event.button === 2 &&
      !panStartRef.current
    ) {
      startMousePan(event.clientX, event.clientY, event.pointerId);
    }
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
      onPointerDownCapture={touchGestures.handlePointerDown}
      onPointerDown={handlePointerDown}
      onPointerMoveCapture={touchGestures.handlePointerMove}
      onPointerUpCapture={touchGestures.handlePointerUp}
      onPointerCancelCapture={touchGestures.handlePointerCancel}
      onWheel={handleWheel}
      style={{ touchAction: "none" }}
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
