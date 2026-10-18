import { memo, useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { getCanvasTransition } from '@ui/canvas/canvasMotion';
import { useMotionPreference } from '@ui/motion_preferences/MotionPreferenceProvider';
import type { LayoutPoint } from '@core/layout/types';
import type { Zone } from '@entities/zone/types';
import type { ZoneLayerProps } from './zoneLayerTypes';
import { getZoneResizeHandles } from './zoneGeometry';
import { zoneResizeCursor } from './zoneResizeCursor';
import { ZoneResizeHandle } from './ZoneResizeHandle';

type Props = Pick<ZoneLayerProps, 'onResizeHandleMouseDown' | 'onResizeHandleDrag' | 'onResizeHandleDragEnd'> & {
  zone: Zone;
  polygon: LayoutPoint[];
  zoneDrag: ZoneLayerProps['zoneDrag'];
  direct: boolean;
};

/** Render after every Zone body so covered handles retain pointer priority. */
export const ZoneResizeHandles = memo(function ZoneResizeHandles({ zone, polygon, zoneDrag, direct,
  onResizeHandleMouseDown, onResizeHandleDrag, onResizeHandleDragEnd }: Props) {
  const { animationsDisabled } = useMotionPreference();
  const [dragCursor, setDragCursor] = useState<string>();
  useEffect(() => {
    if (!dragCursor) return;
    // Keep cursor feedback even when the pointer leaves the handle while dragging.
    const style = document.createElement('style');
    style.textContent = `html * { cursor: ${dragCursor} !important; }`;
    document.head.append(style);
    const release = () => setDragCursor(undefined);
    const cancel = (event: KeyboardEvent) => { if (event.key === 'Escape') release(); };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    window.addEventListener('blur', release);
    window.addEventListener('keydown', cancel);
    return () => {
      style.remove();
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
      window.removeEventListener('blur', release);
      window.removeEventListener('keydown', cancel);
    };
  }, [dragCursor]);
  const dragging = zoneDrag?.phase === 'dragging';
  const gesture = useRef(0);
  if (dragging && zoneDrag.gestureId !== undefined) gesture.current = zoneDrag.gestureId;
  const displayedPolygon = dragging ? polygon.map(point => ({
    x: point.x + zoneDrag.current.x - zoneDrag.start.x,
    y: point.y + zoneDrag.current.y - zoneDrag.start.y
  })) : polygon;
  const transition = getCanvasTransition(direct, animationsDisabled);
  return <motion.g data-zone-resize-handles={zone.id} initial={false}
    transition={transition}>
    {getZoneResizeHandles(zone, displayedPolygon).map((point, index) => {
      const cursor = zoneResizeCursor(displayedPolygon, point);
      return <ZoneResizeHandle key={`${gesture.current}:${index}`} zone={zone}
        polygon={displayedPolygon} point={point} index={index} cursor={cursor}
        transition={transition} direct={direct}
        onCursorChange={setDragCursor} onResizeHandleMouseDown={onResizeHandleMouseDown}
        onResizeHandleDrag={onResizeHandleDrag} onResizeHandleDragEnd={onResizeHandleDragEnd} />;
    })}
  </motion.g>;
});
