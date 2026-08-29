import { AnimatePresence, motion } from "motion/react";
import type {
  PointerEvent as ReactPointerEvent,
  ReactNode
} from "react";
import { useEffect, useRef, useState } from "react";

const HOLD_DURATION_MS = 500;
const MOVE_TOLERANCE_PX = 8;
const TOOLTIP_DURATION_MS = 1800;

type TouchTooltipProps = {
  children: ReactNode;
  label: string;
};

type PendingTouch = {
  pointerId: number;
  startX: number;
  startY: number;
  target: HTMLElement;
};

type VisibleTooltip = {
  above: boolean;
  label: string;
  left: number;
  top: number;
};

/** Marks an element with a tooltip label for delegated touch-hold discovery. */
export function TouchTooltip({ children, label }: TouchTooltipProps) {
  return (
    <span className="relative inline-flex" data-touch-tooltip-label={label}>
      {children}
    </span>
  );
}

function findTooltipTarget(target: EventTarget): {
  element: HTMLElement;
  label: string;
} | null {
  if (!(target instanceof Element)) return null;
  const element = target.closest<HTMLElement>(
    "[data-touch-tooltip-label], [title]"
  );
  if (!element) return null;
  const label = element.dataset.touchTooltipLabel ?? element.title;
  return label.trim() ? { element, label } : null;
}

/**
 * Shows title-equivalent help after a touch-only hold. Mouse pointers are
 * deliberately ignored so desktop continues to rely on ordinary hover help.
 */
export function TouchTooltipProvider({ children }: { children: ReactNode }) {
  const [tooltip, setTooltip] = useState<VisibleTooltip | null>(null);
  const pendingRef = useRef<PendingTouch | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressNextClickRef = useRef(false);

  function clearHold() {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    holdTimerRef.current = null;
    pendingRef.current = null;
  }

  function clearHide() {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = null;
  }

  useEffect(
    () => () => {
      clearHold();
      clearHide();
    },
    []
  );

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "touch" || event.button !== 0) return;
    const resolved = findTooltipTarget(event.target);
    if (!resolved) return;

    clearHold();
    clearHide();
    setTooltip(null);
    pendingRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      target: resolved.element
    };
    holdTimerRef.current = setTimeout(() => {
      const pending = pendingRef.current;
      if (!pending || pending.pointerId !== event.pointerId) return;
      const rect = pending.target.getBoundingClientRect();
      const above = rect.top >= 56;
      setTooltip({
        above,
        label: resolved.label,
        left: Math.min(
          Math.max(rect.left + rect.width / 2, 80),
          Math.max(80, window.innerWidth - 80)
        ),
        top: above ? rect.top - 8 : rect.bottom + 8
      });
      suppressNextClickRef.current = true;
      holdTimerRef.current = null;
      hideTimerRef.current = setTimeout(() => {
        setTooltip(null);
        hideTimerRef.current = null;
      }, TOOLTIP_DURATION_MS);
    }, HOLD_DURATION_MS);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const pending = pendingRef.current;
    if (!pending || pending.pointerId !== event.pointerId) return;
    if (
      Math.hypot(
        event.clientX - pending.startX,
        event.clientY - pending.startY
      ) > MOVE_TOLERANCE_PX
    ) {
      clearHold();
    }
  }

  function handlePointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    if (pendingRef.current?.pointerId === event.pointerId) clearHold();
  }

  return (
    <div
      className="contents"
      onClickCapture={(event) => {
        if (!suppressNextClickRef.current) return;
        event.preventDefault();
        event.stopPropagation();
        suppressNextClickRef.current = false;
      }}
      onContextMenuCapture={(event) => {
        if (suppressNextClickRef.current) event.preventDefault();
      }}
      onPointerCancelCapture={handlePointerEnd}
      onPointerDownCapture={handlePointerDown}
      onPointerMoveCapture={handlePointerMove}
      onPointerUpCapture={handlePointerEnd}
    >
      {children}
      <AnimatePresence>
        {tooltip ? (
          <motion.div
            animate={{ opacity: 1 }}
            className="pointer-events-none fixed z-[100] max-w-[calc(100vw-1.5rem)] rounded-md bg-canvas-ink px-2 py-1 text-center text-xs font-medium text-white shadow-lg"
            data-touch-tooltip="true"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            role="tooltip"
            style={{
              left: tooltip.left,
              top: tooltip.top,
              transform: tooltip.above
                ? "translate(-50%, -100%)"
                : "translateX(-50%)"
            }}
          >
            {tooltip.label}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
