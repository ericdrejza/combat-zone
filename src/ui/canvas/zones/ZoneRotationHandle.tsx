import { getCanvasTransition } from '@ui/canvas/canvasMotion';
import { useMotionPreference } from '@ui/motion_preferences/MotionPreferenceProvider';
import { useEffect, useRef } from 'react';
import { RotateCcw } from 'lucide-react';
import { motion } from 'motion/react';
import type { PointerEvent } from 'react';
import type { Zone } from '@entities/zone/types';
import { getZoneLocalPolygon, rotatePoint } from '@entities/zone/zoneRotation';
import { getPolygonBounds } from '@core/layout/polygonGeometry';
import type { LayoutPoint } from '@core/layout/types';
import { usePersistence } from '@ui/persistence/PersistenceProvider';
import { useCanvasViewport } from '@ui/canvas/CanvasViewportContext';
import { toSvgPoint } from './zoneGeometry';
import type { ZoneLayerProps } from './zoneLayerTypes';

type Props = Pick<ZoneLayerProps, 'onResizeHandleMouseDown' | 'onResizeHandleDrag' | 'onResizeHandleDragEnd' | 'onZoneRotationCancel'> & {
  zone: Zone; polygon: LayoutPoint[]; active: boolean; direct: boolean;
};

/** Pointer capture keeps angular input independent of the moving handle. */
export function ZoneRotationHandle({ zone, polygon, active, direct, onResizeHandleMouseDown, onResizeHandleDrag, onResizeHandleDragEnd, onZoneRotationCancel }: Props) {
  const { readOnly } = usePersistence();
  const { animationsDisabled } = useMotionPreference();
  const transition = getCanvasTransition(direct, animationsDisabled);
  const viewport = useCanvasViewport();
  const scale = viewport.zoom;
  const gesture = useRef<{ pointerId: number; start: LayoutPoint; revision?: number }>();
  const bounds = getPolygonBounds(getZoneLocalPolygon({ ...zone, polygon }));
  const start = rotatePoint({ x: (bounds.minX + bounds.maxX) / 2, y: bounds.minY }, zone.rotation ?? 0);
  const point = rotatePoint({ x: (bounds.minX + bounds.maxX) / 2, y: bounds.minY - 32 / scale }, zone.rotation ?? 0);
  const degrees = Math.round(zone.rotation ?? 0) || 0;
  useEffect(() => {
    const cancel = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && gesture.current) { gesture.current = undefined; onZoneRotationCancel?.(); }
    };
    const blur = () => { if (gesture.current) { gesture.current = undefined; onZoneRotationCancel?.(); } };
    window.addEventListener('keydown', cancel);
    window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', cancel); window.removeEventListener('blur', blur); };
  }, [onZoneRotationCancel]);
  useEffect(() => { if (!active) gesture.current = undefined; }, [active]);
  useEffect(() => () => { if (gesture.current) { gesture.current = undefined; onZoneRotationCancel?.(); } }, [onZoneRotationCancel]);
  useEffect(() => {
    if (!active || readOnly) return;
    const style = document.createElement('style');
    style.textContent = 'html * { cursor: grabbing !important; }';
    document.head.append(style);
    return () => style.remove();
  }, [active, readOnly]);
  function end(event: PointerEvent<SVGCircleElement>, cancel: boolean) {
    const current = gesture.current;
    if (!current || event.pointerId !== current.pointerId) return;
    event.stopPropagation();
    gesture.current = undefined;
    if (cancel) onZoneRotationCancel?.();
    else onResizeHandleDragEnd(event, current.revision);
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  return <g data-zone-rotation-handle={zone.id}>
    <motion.line initial={false} animate={{ x1: start.x, y1: start.y, x2: point.x, y2: point.y }} transition={transition} strokeWidth={1 / scale}
      className="pointer-events-none stroke-canvas-ink" />
    <motion.g initial={false} animate={{ x: point.x, y: point.y }} transition={transition}
      className={readOnly ? 'text-canvas-muted opacity-50' : 'text-canvas-ink'}>
      {active || degrees !== 0 ? <text y={-17 / scale} aria-label="Zone rotation"
        className="pointer-events-none fill-canvas-ink stroke-canvas-panel text-[10px] font-semibold"
        strokeWidth={2 / scale} style={{ paintOrder: 'stroke', fontSize: 10 / scale }} textAnchor="middle">{degrees}°</text> : null}
      <RotateCcw x={-8 / scale} y={-8 / scale} width={16 / scale} height={16 / scale} className="pointer-events-none" />
    </motion.g>
    <motion.circle initial={false} animate={{ cx: point.x, cy: point.y, r: 14 / scale }} transition={transition} role="button" aria-label={`Rotate ${zone.name}`}
      aria-disabled={readOnly} tabIndex={readOnly ? -1 : 0} data-touch-tooltip-label="Drag to rotate zone"
      className={readOnly ? 'cursor-not-allowed fill-transparent' : 'fill-transparent hover:fill-canvas-muted/30 focus-visible:fill-canvas-muted/30 focus-visible:stroke-canvas-ink focus-visible:outline-none'}
      style={{ cursor: readOnly ? undefined : active ? 'grabbing' : 'grab', touchAction: 'none' }}
      onClick={event => { event.preventDefault(); event.stopPropagation(); }}
      onDoubleClick={event => event.stopPropagation()}
      onMouseDown={event => event.stopPropagation()}
      onPointerDown={event => {
        event.preventDefault(); event.stopPropagation();
        if (readOnly || event.button !== 0) return;
        const svg = event.currentTarget.ownerSVGElement;
        if (!svg) return;
        const pointer = toSvgPoint(event, svg);
        const revision = onResizeHandleMouseDown(zone, polygon, pointer, -1, event);
        if (revision === undefined) return;
        gesture.current = { pointerId: event.pointerId, start: pointer, revision };
        event.currentTarget.setPointerCapture?.(event.pointerId);
      }}
      onPointerMove={event => {
        const current = gesture.current;
        const svg = event.currentTarget.ownerSVGElement;
        if (!current || current.pointerId !== event.pointerId || !svg) return;
        event.stopPropagation();
        const pointer = toSvgPoint(event, svg);
        onResizeHandleDrag({ x: pointer.x - current.start.x, y: pointer.y - current.start.y }, current.revision, event.timeStamp);
      }} onPointerUp={event => end(event, false)} onPointerCancel={event => end(event, true)} onLostPointerCapture={event => end(event, true)}>
      <title>Drag to rotate zone</title>
    </motion.circle>
  </g>;
}
