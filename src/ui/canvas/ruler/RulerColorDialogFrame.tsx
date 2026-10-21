import { useCallback, useEffect, useLayoutEffect, useRef, type FormEvent, type ReactNode } from 'react';
import { GripHorizontal } from 'lucide-react';
import { MotionConfig, motion, useDragControls, useMotionValue } from 'motion/react';

const screenPoint = (point: { x: number; y: number }) => point;

/** A transparent modal preserves AoE visibility; only the centered handle initiates dragging. */
export function RulerColorDialogFrame({ children, onClose, onSubmit }: {
  children: ReactNode; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const bounds = useRef<HTMLDivElement>(null), panel = useRef<HTMLFormElement>(null);
  const beganOutside = useRef(true);
  const controls = useDragControls(), x = useMotionValue(0), y = useMotionValue(0);
  const moveBy = useCallback((dx: number, dy: number) => {
    if (!panel.current || !bounds.current) return;
    const box = panel.current.getBoundingClientRect(), parent = bounds.current.getBoundingClientRect();
    x.set(x.get() + Math.max(parent.left - box.left, Math.min(parent.right - box.right, dx)));
    y.set(y.get() + Math.max(parent.top - box.top, Math.min(parent.bottom - box.bottom, dy)));
  }, [x, y]);
  useLayoutEffect(() => {
    const element = panel.current, container = bounds.current;
    if (!element || !container) return;
    const ownerWindow = element.ownerDocument.defaultView;
    const constrain = () => moveBy(0, 0);
    const Observer = ownerWindow?.ResizeObserver ?? globalThis.ResizeObserver;
    const observer = Observer ? new Observer(constrain) : null;
    observer?.observe(element); observer?.observe(container);
    ownerWindow?.addEventListener('resize', constrain);
    return () => { observer?.disconnect(); ownerWindow?.removeEventListener('resize', constrain); };
  }, [moveBy]);
  useEffect(() => {
    const previous = panel.current?.ownerDocument.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLElement>('input, select, button:not([data-dialog-drag-handle])')?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, []);
  // Portal events still bubble to CanvasViewport, which owns right-button panning.
  return <MotionConfig transformPagePoint={screenPoint}>
    <div ref={bounds} className="viewport-overlay z-[110] flex items-center justify-center p-4"
      onPointerDownCapture={event => { beganOutside.current = event.target === event.currentTarget; }}
      onPointerDown={event => { if (event.button !== 2) event.stopPropagation(); }}
      onMouseDown={event => event.stopPropagation()}
      onContextMenu={event => { event.preventDefault(); event.stopPropagation(); }}
      onClick={event => { event.stopPropagation(); if (event.button === 0 && event.target === event.currentTarget && beganOutside.current) onClose(); }}
      onKeyDown={event => {
        event.stopPropagation();
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); }
        if (event.key !== 'Tab') return;
        const controls = Array.from(panel.current?.querySelectorAll<HTMLElement>('input:not(:disabled), select:not(:disabled), button:not(:disabled)') ?? []);
        const current = panel.current?.ownerDocument.activeElement;
        if (event.shiftKey && current === controls[0]) { event.preventDefault(); controls.at(-1)?.focus(); }
        else if (!event.shiftKey && current === controls.at(-1)) { event.preventDefault(); controls[0]?.focus(); }
      }}>
      <motion.form ref={panel} noValidate role="dialog" aria-modal="true" aria-label="Ruler color"
        drag dragControls={controls} dragListener={false} dragMomentum={false} dragElastic={0} dragConstraints={bounds} style={{ x, y }}
        className="max-h-[calc(100dvh-2rem)] w-full max-w-sm space-y-4 overflow-y-auto rounded-2xl border border-canvas-line bg-canvas-panel p-4 text-canvas-ink shadow-xl"
        onSubmit={onSubmit}>
        <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <h2 className="text-sm font-semibold">Ruler color</h2>
          <button data-dialog-drag-handle type="button" aria-label="Move ruler color dialog"
            title="Drag to move; arrow keys also move this dialog" data-touch-tooltip-label="Drag to move; arrow keys also move this dialog"
            className="touch-none cursor-grab rounded p-2 text-canvas-muted hover:bg-canvas-surface hover:text-canvas-ink focus-visible:ring-2 focus-visible:ring-canvas-ink active:cursor-grabbing"
            onPointerDown={event => { if (event.button === 0) controls.start(event); }} onKeyDown={event => {
              const delta = ({ ArrowLeft: [-20, 0], ArrowRight: [20, 0], ArrowUp: [0, -20], ArrowDown: [0, 20] } as Record<string, number[]>)[event.key];
              if (!delta) return;
              event.preventDefault(); event.stopPropagation();
              moveBy(delta[0], delta[1]);
            }}><GripHorizontal size={18} aria-hidden="true" /></button>
          <span aria-hidden="true" />
        </header>
        {children}
      </motion.form>
    </div>
  </MotionConfig>;
}
