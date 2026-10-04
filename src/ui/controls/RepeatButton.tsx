import { useEffect, useRef, type ButtonHTMLAttributes } from "react";

export const REPEAT_DELAY_MS = 400;
export const REPEAT_INTERVAL_MS = 80;
type Hold = { element: HTMLButtonElement; ownerWindow: Window; pointerId: number; delay?: number; interval?: number; cleanup: () => void };

/** Repeats native clicks, preserving the latest handler and existing mutation semantics. */
export function RepeatButton({ disabled, title, onClick, onPointerDown, onPointerMove, onPointerLeave, onPointerUp, onPointerCancel, onLostPointerCapture, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  const hold = useRef<Hold | null>(null);
  const suppressReleaseClick = useRef(false);
  function stop() {
    const active = hold.current;
    if (!active) return;
    hold.current = null;
    active.ownerWindow.clearTimeout(active.delay);
    active.ownerWindow.clearInterval(active.interval);
    active.cleanup();
    if (active.element.hasPointerCapture?.(active.pointerId)) active.element.releasePointerCapture(active.pointerId);
  }
  useEffect(() => stop, []);
  useEffect(() => { if (disabled) stop(); }, [disabled]);
  const label = title ?? (typeof props["aria-label"] === "string" ? props["aria-label"] : undefined);
  return <button {...props} disabled={disabled} data-press-repeat="true" title={label && !disabled ? `${label} (hold to repeat)` : label} onClick={(event) => {
    if (suppressReleaseClick.current && event.detail > 0) {
      suppressReleaseClick.current = false;
      event.preventDefault(); event.stopPropagation();
      return;
    }
    onClick?.(event);
  }} onPointerDown={(event) => {
    onPointerDown?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.isPrimary === false || event.currentTarget.disabled) return;
    stop();
    suppressReleaseClick.current = false;
    const element = event.currentTarget;
    const ownerWindow = element.ownerDocument.defaultView;
    if (!ownerWindow) return;
    const end = (pointerEvent: PointerEvent) => { if (pointerEvent.pointerId === event.pointerId) stop(); };
    const blur = () => stop();
    const hide = () => { if (element.ownerDocument.hidden) stop(); };
    ownerWindow.addEventListener("pointerup", end);
    ownerWindow.addEventListener("pointercancel", end);
    ownerWindow.addEventListener("blur", blur);
    element.ownerDocument.addEventListener("visibilitychange", hide);
    const active: Hold = { element, ownerWindow, pointerId: event.pointerId, cleanup: () => {
      ownerWindow.removeEventListener("pointerup", end);
      ownerWindow.removeEventListener("pointercancel", end);
      ownerWindow.removeEventListener("blur", blur);
      element.ownerDocument.removeEventListener("visibilitychange", hide);
    } };
    hold.current = active;
    element.setPointerCapture?.(event.pointerId);
    element.click();
    suppressReleaseClick.current = true;
    const repeat = () => {
      if (element.disabled || !element.isConnected) { stop(); return; }
      element.click();
    };
    active.delay = ownerWindow.setTimeout(() => { if (hold.current !== active) return; repeat(); if (hold.current === active) active.interval = ownerWindow.setInterval(repeat, REPEAT_INTERVAL_MS); }, REPEAT_DELAY_MS);
  }} onPointerMove={(event) => {
    onPointerMove?.(event);
    if (!hold.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0 && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) stop();
  }} onPointerLeave={(event) => { onPointerLeave?.(event); stop(); }} onPointerUp={(event) => { onPointerUp?.(event); stop(); }} onPointerCancel={(event) => { onPointerCancel?.(event); stop(); }} onLostPointerCapture={(event) => { onLostPointerCapture?.(event); stop(); }} onContextMenu={(event) => { if (hold.current) event.preventDefault(); props.onContextMenu?.(event); }} />;
}
