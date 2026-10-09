import { animate, motion, useDragControls, useMotionValue, useTransform } from "motion/react";
import { Pencil, Trash2 } from "lucide-react";
import { useRef, type ReactNode } from "react";

/** Require intentional movement even for fast flicks; adapt distance to narrow panels. */
export function counterSwipeAction(offset: number, velocity: number, width: number): "delete" | "edit" | null {
  const threshold = Math.min(72, width * 0.3);
  const flick = Math.abs(offset) >= 20 && Math.abs(velocity) >= 500 && Math.sign(offset) === Math.sign(velocity);
  if (Math.abs(offset) < threshold && !flick) return null;
  return offset > 0 ? "delete" : "edit";
}

/** Touch-only actions leave mouse interaction and vertical panel scrolling available. */
export function SwipeCounterRow({ children, disabled, onDelete, onEdit }: {
  children: ReactNode;
  disabled: boolean;
  onDelete: () => void;
  onEdit: () => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const controls = useDragControls();
  const x = useMotionValue(0);
  const deleteWidth = useTransform(x, (value) => Math.max(0, value));
  const editWidth = useTransform(x, (value) => Math.max(0, -value));
  const dragged = useRef(false);
  return <div ref={container} className="relative min-w-0 overflow-hidden rounded">
    <motion.div aria-hidden="true" style={{ width: deleteWidth }} className="pointer-events-none absolute inset-y-0 left-0 flex items-center justify-start overflow-hidden bg-red-500 text-black">
      <Trash2 className="mx-3 h-5 w-5 shrink-0" />
    </motion.div>
    <motion.div aria-hidden="true" style={{ width: editWidth }} className="pointer-events-none absolute inset-y-0 right-0 flex items-center justify-end overflow-hidden bg-canvas-surface text-canvas-ink">
      <Pencil className="mx-3 h-5 w-5 shrink-0" />
    </motion.div>
    <motion.div style={{ x, touchAction: "pan-y" }} drag={disabled ? false : "x"} dragControls={controls} dragListener={false} dragMomentum={false}
      onPointerDown={(event) => {
        dragged.current = false;
        if (disabled || event.pointerType !== "touch" || (event.target as HTMLElement).closest("button, input, select, textarea")) return;
        controls.start(event);
      }}
      onDragStart={() => { dragged.current = true; }}
      onPointerCancel={() => { void animate(x, 0, { duration: 0.15 }); }}
      onClickCapture={(event) => { if (dragged.current) { event.preventDefault(); event.stopPropagation(); dragged.current = false; } }}
      onDragEnd={(event, info) => {
        const action = event.type === "pointercancel" || disabled ? null : counterSwipeAction(info.offset.x, info.velocity.x, container.current?.clientWidth || 240);
        void animate(x, 0, { duration: 0.15 });
        if (action === "delete") onDelete();
        if (action === "edit") onEdit();
      }} className="relative bg-canvas">
      {children}
    </motion.div>
  </div>;
}
