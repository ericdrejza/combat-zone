import { useEffect, useRef, type PointerEvent } from 'react';

type Input = {
  active: boolean;
  place: (event: PointerEvent<SVGElement>) => void;
  preview: (event: PointerEvent<SVGElement>) => void;
  openMenu: (menu: { id: string; x: number; y: number }) => void;
};

/** Saved-artifact hit targets keep context actions without swallowing ruler placement. */
export function useRulerArtifactInput({ active, place, preview, openMenu }: Input) {
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touch = useRef<{ x: number; y: number; moved: boolean; held: boolean } | null>(null);
  const clearTimer = () => { if (hold.current) clearTimeout(hold.current); hold.current = null; };
  useEffect(() => () => { if (hold.current) clearTimeout(hold.current); }, []);
  return (id: string) => ({
    onPointerDown(event: PointerEvent<SVGGElement>) {
      if (event.button !== 0) return;
      if (event.pointerType !== 'touch') { if (active) place(event); return; }
      if (active) event.stopPropagation(); clearTimer();
      const point = { x: event.clientX, y: event.clientY, moved: false, held: false };
      touch.current = point;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      hold.current = setTimeout(() => { point.held = true; openMenu({ id, x: point.x, y: point.y }); }, 500);
    },
    onPointerMove(event: PointerEvent<SVGGElement>) {
      const point = touch.current;
      if (point && Math.hypot(event.clientX - point.x, event.clientY - point.y) > 8) { point.moved = true; clearTimer(); }
      if (active) preview(event);
    },
    onPointerUp(event: PointerEvent<SVGGElement>) {
      const point = touch.current; touch.current = null; clearTimer();
      if (event.pointerType === 'touch') {
        if (active) event.stopPropagation(); event.currentTarget.releasePointerCapture?.(event.pointerId);
        if (active && point && !point.moved && !point.held) place(event);
      }
    },
    onPointerCancel() { clearTimer(); touch.current = null; },
    onClick(event: React.MouseEvent<SVGGElement>) { if (active) event.stopPropagation(); },
    onDoubleClick(event: React.MouseEvent<SVGGElement>) { if (active) event.stopPropagation(); }
  });
}
