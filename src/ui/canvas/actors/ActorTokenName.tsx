import { useLayoutEffect, useRef } from "react";
import { motion, type Transition } from "motion/react";
import type { ActorShape } from "@entities/actor/types";

const DEFAULT_FONT_SIZE = 10;
const MIN_FONT_SIZE = 7;

/** Wrap fallback names, shrinking only when needed and preserving a readable minimum. */
export function ActorTokenName({ name, shape, radius, color, transition }: {
  name: string;
  shape: ActorShape;
  radius: number;
  color: string;
  transition: Transition;
}) {
  // An inscribed square keeps wrapped lines clear of a circular token's curved edges.
  const width = Math.max(1, radius * (shape === "circle" ? Math.SQRT2 : 2) - 6);
  const height = shape === "circle" ? width : Math.max(1, radius * 2 - 6);
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const text = textRef.current;
    if (!container || !text) return;
    let disposed = false;
    const fit = () => {
      if (disposed || !container.clientWidth || !container.clientHeight) return;
      // Measure in local CSS pixels so canvas zoom does not change the chosen size.
      for (let size = DEFAULT_FONT_SIZE; size >= MIN_FONT_SIZE; size -= 0.5) {
        text.style.fontSize = `${size}px`;
        text.style.lineHeight = `${size * 1.2}px`;
        if (text.scrollWidth <= container.clientWidth && text.scrollHeight <= container.clientHeight) break;
      }
    };
    fit();
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(fit);
    observer?.observe(container);
    void container.ownerDocument.fonts?.ready.then(fit);
    return () => { disposed = true; observer?.disconnect(); };
  }, [name, width, height]);
  return <motion.foreignObject
    className="pointer-events-none overflow-visible"
    pointerEvents="none"
    initial={false}
    animate={{ attrX: -width / 2, attrY: -height / 2, width, height }}
    transition={transition}
  >
    <div ref={containerRef} className="flex h-full w-full items-center justify-center text-center text-[10px] font-bold leading-[12px]"
      style={{ color }}>
      <span ref={textRef} className="min-w-0 [overflow-wrap:anywhere]">{name.toUpperCase()}</span>
    </div>
  </motion.foreignObject>;
}
