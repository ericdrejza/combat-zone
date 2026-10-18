import { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, type Transition } from 'motion/react';
import type { LayoutPoint } from '@core/layout/types';
import type { Zone } from '@entities/zone/types';
import type { ZoneLayerProps } from './zoneLayerTypes';

type Props = Pick<ZoneLayerProps, 'onResizeHandleMouseDown' | 'onResizeHandleDrag' | 'onResizeHandleDragEnd'> & {
  zone: Zone;
  polygon: LayoutPoint[];
  point: LayoutPoint;
  index: number;
  cursor: string;
  direct: boolean;
  transition: Transition;
  onCursorChange: (cursor: string | undefined) => void;
};

/** Keep the draggable hit area's origin fixed; only its visible marker follows snapping. */
export function ZoneResizeHandle({ zone, polygon, point, index, cursor, direct, transition,
  onCursorChange, onResizeHandleMouseDown, onResizeHandleDrag, onResizeHandleDragEnd }: Props) {
  const revision = useRef<number>();
  const dragging = useRef(false);
  const [origin, setOrigin] = useState<LayoutPoint | null>(null);
  const x = useMotionValue(0), y = useMotionValue(0);
  const hitPoint = origin ?? point;
  useEffect(() => {
    if (!direct) {
      dragging.current = false;
      x.jump(0); y.jump(0);
      setOrigin(current => current === null ? current : null);
    }
  }, [direct, x, y]);
  return <g>
    <motion.circle animate={{ cx: point.x, cy: point.y, r: 6, strokeWidth: 2 }}
      className="pointer-events-none fill-canvas-ink stroke-white stroke-2" initial={false} transition={transition} />
    <motion.circle aria-label={`${zone.name} vertex ${index + 1}`}
      animate={{ cx: hitPoint.x, cy: hitPoint.y, r: 10 }}
      className="fill-transparent stroke-transparent hover:stroke-canvas-ink focus-visible:stroke-canvas-ink"
      style={{ cursor, x, y }} drag dragElastic={0} dragMomentum={false} initial={false}
      onMouseDown={event => {
        setOrigin(point);
        revision.current = onResizeHandleMouseDown(zone, polygon, point, index, event);
      }}
      onPointerDown={event => {
        onCursorChange(cursor);
        if (event.pointerType !== 'mouse') {
          setOrigin(point);
          revision.current = onResizeHandleMouseDown(zone, polygon, point, index, event);
        }
      }}
      onPointerUp={() => { if (!dragging.current) { setOrigin(null); onCursorChange(undefined); } }}
      onPointerCancel={() => { dragging.current = false; x.jump(0); y.jump(0); setOrigin(null); onCursorChange(undefined); }}
      onDragStart={() => { dragging.current = true; }}
      onDrag={(event, info) => onResizeHandleDrag(info.offset, revision.current, event.timeStamp)}
      onDragEnd={event => {
        dragging.current = false;
        x.jump(0); y.jump(0);
        setOrigin(null);
        onCursorChange(undefined);
        onResizeHandleDragEnd(event, revision.current);
      }}
      transition={transition} />
  </g>;
}
