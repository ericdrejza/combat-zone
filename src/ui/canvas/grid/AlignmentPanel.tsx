import { useRef, type ReactNode } from 'react';
import { motion, useDragControls, useMotionValue } from 'motion/react';
import { GripVertical, Check } from 'lucide-react';

/** Instructions can be moved out of the way of any sampled vertex. */
export function AlignmentPanel({ children }: { children: ReactNode }) {
  const bounds = useRef<HTMLDivElement>(null), panel = useRef<HTMLDivElement>(null);
  const controls = useDragControls(), x = useMotionValue(0), y = useMotionValue(0);
  return <div ref={bounds} className="pointer-events-none absolute inset-0 z-50">
    <motion.div ref={panel} drag dragControls={controls} dragListener={false} dragMomentum={false} dragElastic={0} dragConstraints={bounds} style={{ x, y }}
      role="region" aria-label="Grid alignment" className="pointer-events-auto absolute left-3 right-3 top-3 mx-auto max-w-lg space-y-2 rounded-xl border border-canvas-line bg-canvas-panel p-3 text-canvas-ink shadow-lg">
      <div className="flex items-center gap-2">
        <button type="button" aria-label="Move grid alignment" title="Drag to move; arrow keys also move this panel" className="touch-none rounded p-1 text-canvas-muted hover:bg-canvas-surface hover:text-canvas-ink focus-visible:ring-2 focus-visible:ring-canvas-ink"
          onPointerDown={event => controls.start(event)} onKeyDown={event => {
            const delta = ({ ArrowLeft: [-20, 0], ArrowRight: [20, 0], ArrowUp: [0, -20], ArrowDown: [0, 20] } as Record<string, number[]>)[event.key];
            if (!delta || !panel.current || !bounds.current) return;
            event.preventDefault(); event.stopPropagation();
            const box = panel.current.getBoundingClientRect(), parent = bounds.current.getBoundingClientRect();
            x.set(x.get() + Math.max(parent.left - box.left, Math.min(parent.right - box.right, delta[0])));
            y.set(y.get() + Math.max(parent.top - box.top, Math.min(parent.bottom - box.bottom, delta[1])));
          }}><GripVertical size={16} /></button>
        <span className="text-xs font-semibold">Align grid to background</span>
      </div>
      {children}
    </motion.div>
  </div>;
}
export const alignmentButton = 'min-h-8 rounded-full border border-canvas-line px-2.5 text-xs enabled:hover:bg-canvas-surface focus-visible:ring-2 focus-visible:ring-canvas-ink disabled:cursor-not-allowed disabled:opacity-40';
export function AlignmentToggle({ active, children, onClick }: { active: boolean; children: ReactNode; onClick: () => void }) {
  return <button type="button" aria-pressed={active} onClick={onClick}
    className={`${alignmentButton} inline-flex items-center gap-1 ${active ? 'border-canvas-ink bg-canvas-ink text-canvas-on-ink enabled:hover:bg-canvas-ink enabled:hover:ring-2 enabled:hover:ring-canvas-muted' : 'text-canvas-ink'}`}>
    {active ? <Check size={12} aria-hidden="true" /> : null}{children}
  </button>;
}
