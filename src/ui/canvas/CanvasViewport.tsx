import {
  type MouseEvent,
  type PointerEvent,
  type PropsWithChildren,
  type WheelEvent,
  useCallback,
  useEffect,
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
  const pendingContextMenu = useRef<globalThis.MouseEvent | null>(null);
  const cleanupPan = useRef<(() => void) | null>(null);
  useEffect(() => () => { cleanupPan.current?.(); }, []);
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

    event.preventDefault();
    startMousePan(event.clientX, event.clientY);
  }

  function startMousePan(clientX: number, clientY: number, pointerId?: number) {
    const element = elementRef.current;
    if (!element || !viewport.panEnabled) return;

    viewport.stopPanAnimation();
    panStartRef.current = {
      clientX,
      clientY,
      pointerId,
      scrollLeft: element.scrollLeft,
      scrollTop: element.scrollTop
    };
    pannedRef.current = false;
    pendingContextMenu.current = null;

    const handleMove = (moveEvent: Pick<globalThis.MouseEvent, "clientX" | "clientY">) => {
      const start = panStartRef.current;
      if (!start) return;

      const deltaX = moveEvent.clientX - start.clientX;
      const deltaY = moveEvent.clientY - start.clientY;
      if (Math.hypot(deltaX, deltaY) >= 2) pannedRef.current = true;
      element.scrollLeft = start.scrollLeft - deltaX;
      element.scrollTop = start.scrollTop - deltaY;
    };
    const removeListeners = () => {
      window.removeEventListener("mousemove", handleMove, true);
      window.removeEventListener("mouseup", handleUp, true);
      window.removeEventListener("pointermove", handleMove, true);
      window.removeEventListener("pointerup", handleUp, true);
      window.removeEventListener("pointercancel", handleUp, true);
    };
    const handleUp = (event: globalThis.MouseEvent) => {
      const pending = pendingContextMenu.current;
      pendingContextMenu.current = null;
      panStartRef.current = null;
      removeListeners();
      cleanupPan.current = null;
      // Browsers can emit contextmenu on press or release. Defer press-time
      // actions until we know this was a click rather than a pan.
      if (pending && !pannedRef.current && event.type !== "pointercancel") {
        const ContextMenuEvent = element.ownerDocument.defaultView?.MouseEvent ?? globalThis.MouseEvent;
        pending.target?.dispatchEvent(new ContextMenuEvent("contextmenu", {
          bubbles: true, cancelable: true, composed: true, button: 2,
          clientX: pending.clientX, clientY: pending.clientY,
          screenX: pending.screenX, screenY: pending.screenY,
          ctrlKey: pending.ctrlKey, shiftKey: pending.shiftKey,
          altKey: pending.altKey, metaKey: pending.metaKey
        }));
      }
    };
    cleanupPan.current = removeListeners;
    // Tool handlers can stop bubbling; navigation must still see moves and release.
    window.addEventListener("mousemove", handleMove, true);
    window.addEventListener("mouseup", handleUp, true);
    if (pointerId !== undefined) {
      window.addEventListener("pointermove", handleMove, true);
      window.addEventListener("pointerup", handleUp, true);
      window.addEventListener("pointercancel", handleUp, true);
    }
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch") return;

    if (
      event.pointerType === "mouse" &&
      event.button === 2 &&
      !panStartRef.current && viewport.panEnabled
    ) {
      event.preventDefault();
      startMousePan(event.clientX, event.clientY, event.pointerId);
    }
  }

  function handleContextMenu(event: MouseEvent<HTMLDivElement>) {
    if (panStartRef.current) {
      event.preventDefault(); event.stopPropagation();
      pendingContextMenu.current = pannedRef.current ? null : event.nativeEvent;
      return;
    }
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
