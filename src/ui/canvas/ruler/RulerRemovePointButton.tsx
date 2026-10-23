import { useEffect, useRef } from 'react';
import { UndoDot } from 'lucide-react';
import { ToolbarOptionButton } from '@ui/toolbar/ToolbarOption';
import { CLEAR_RULER_POINTS_EVENT, REMOVE_RULER_POINT_EVENT } from './rulerEvents';

/** Holding clears the temporary edit, restoring its saved version when one exists. */
export function RulerRemovePointButton() {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null), held = useRef(false);
  const clearTimer = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
  useEffect(() => clearTimer, []);
  return <ToolbarOptionButton aria-label="Remove last ruler point" title="Remove last point; hold to clear points"
    onPointerDown={event => {
      if (event.button !== 0) return;
      held.current = false; clearTimer();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      timer.current = setTimeout(() => { held.current = true; window.dispatchEvent(new Event(CLEAR_RULER_POINTS_EVENT)); }, 500);
    }}
    onContextMenu={event => event.preventDefault()}
    onPointerUp={clearTimer} onPointerCancel={() => { held.current = true; clearTimer(); }}
    onLostPointerCapture={clearTimer}
    onClick={() => { clearTimer(); if (!held.current) window.dispatchEvent(new Event(REMOVE_RULER_POINT_EVENT)); held.current = false; }}>
    <UndoDot size={18} aria-hidden="true" />
  </ToolbarOptionButton>;
}
