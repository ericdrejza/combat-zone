import { useLayoutEffect, useRef, useState } from 'react';
import type { LayoutPoint } from '@core/layout/types';
import type { CanvasSize } from '@core/layout/polygonCanvasBounds';

/** Measure the complete caption before paint; long names shrink to the available map width. */
export function RulerLabel({ text, point, bounds, interactive }: { text: string; point: LayoutPoint; bounds: CanvasSize; interactive: boolean }) {
  const ref = useRef<SVGTextElement>(null), [width, setWidth] = useState(text.length * 10);
  useLayoutEffect(() => {
    const element = ref.current, previous = element?.getAttribute('textLength');
    element?.removeAttribute('textLength');
    const intrinsic = element?.getComputedTextLength?.() || text.length * 10;
    if (previous) element?.setAttribute('textLength', previous);
    setWidth(intrinsic);
  }, [text]);
  const { x, y, available } = rulerLabelPosition(point, bounds, width);
  return <text ref={ref} x={x} y={y} textLength={width > available ? available : undefined} lengthAdjust="spacingAndGlyphs"
    stroke="none" fill="currentColor" fontSize={16} pointerEvents={interactive ? 'all' : 'none'} aria-label="Measurement result">{text}</text>;
}

export function rulerLabelPosition(point: LayoutPoint, bounds: CanvasSize, width: number) {
  const available = Math.max(1, bounds.width - 16), fitted = Math.min(width, available);
  return { x: Math.max(8, Math.min(point.x + 10, bounds.width - fitted - 8)), y: Math.max(20, Math.min(point.y - 12, bounds.height - 8)), available };
}
