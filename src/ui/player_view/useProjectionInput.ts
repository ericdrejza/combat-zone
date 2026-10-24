import { useEffect, useRef } from 'react';
import { useKeybinds } from '@ui/keybinds';
import type { CanvasSize } from '@core/layout/polygonCanvasBounds';
import { playerFrame } from './playerCamera';
import type { usePlayerCamera } from './usePlayerCamera';

/** Project input through both letterboxes before applying the existing canvas camera operations. */
export function useProjectionInput(camera: ReturnType<typeof usePlayerCamera>, resolution: CanvasSize, interactive: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const { ctrlWheelZoomEnabled } = useKeybinds();
  const latest = useRef({ camera, resolution, ctrlWheelZoomEnabled });
  latest.current = { camera, resolution, ctrlWheelZoomEnabled };
  useEffect(() => {
    const element = ref.current;
    if (!element || !interactive) return;
    const pointers = new Map<number, { x: number; y: number }>();
    let pinch: { point: { x: number; y: number }; zoom: number; distance: number } | null = null;
    const midpoint = (points: { x: number; y: number }[]) => ({ x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 });
    const distance = (points: { x: number; y: number }[]) => Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
    let rightDrag: { x: number; y: number } | null = null;
    const coordinates = (clientX: number, clientY: number) => {
      const { camera, resolution } = latest.current;
      const bounds = element.getBoundingClientRect();
      const outer = playerFrame({ x: 0, y: 0, ...resolution }, bounds);
      const inner = playerFrame(camera.region, resolution);
      const scale = outer.scale * inner.scale || 1;
      return { scale, x: camera.region.x + (clientX - bounds.left - outer.x - inner.x * outer.scale) / scale,
        y: camera.region.y + (clientY - bounds.top - outer.y - inner.y * outer.scale) / scale };
    };
    const wheel = (event: WheelEvent) => {
      const { camera, ctrlWheelZoomEnabled } = latest.current;
      if (event.ctrlKey && !ctrlWheelZoomEnabled) return;
      event.preventDefault();
      const point = coordinates(event.clientX, event.clientY);
      if (event.ctrlKey) camera.zoomBy(event.deltaY < 0 ? 0.1 : -0.1, point);
      else camera.panBy((event.shiftKey ? event.deltaY || event.deltaX : event.deltaX) / point.scale,
        (event.shiftKey ? 0 : event.deltaY) / point.scale);
    };
    const down = (event: PointerEvent) => {
      if (event.pointerType === 'touch') {
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (pointers.size === 2) {
          const points = [...pointers.values()], center = midpoint(points);
          pinch = { point: coordinates(center.x, center.y), zoom: latest.current.camera.viewport.zoom, distance: Math.max(1, distance(points)) };
          event.preventDefault();
        }
      } else if (event.button === 2 && latest.current.camera.viewport.panEnabled) {
        event.preventDefault(); rightDrag = { x: event.clientX, y: event.clientY };
      } else return;
      latest.current.camera.viewport.stopPanAnimation();
      element.setPointerCapture?.(event.pointerId);
    };
    const move = (event: PointerEvent) => {
      const { camera } = latest.current;
      const point = { x: event.clientX, y: event.clientY };
      const scale = coordinates(point.x, point.y).scale;
      if (event.pointerType === 'touch' && pointers.has(event.pointerId)) {
        pointers.set(event.pointerId, point);
        const after = [...pointers.values()];
        if (!pinch || after.length !== 2) return;
        event.preventDefault();
        const center = midpoint(after);
        camera.zoomAt(pinch.zoom * distance(after) / pinch.distance, pinch.point, coordinates(center.x, center.y));
      } else if (rightDrag) {
        camera.panBy((rightDrag.x - point.x) / scale, (rightDrag.y - point.y) / scale);
        rightDrag = point;
      }
    };
    const up = (event: PointerEvent) => {
      pointers.delete(event.pointerId); rightDrag = null;
      if (pointers.size < 2) pinch = null;
      if (element.hasPointerCapture?.(event.pointerId)) element.releasePointerCapture(event.pointerId);
    };
    const context = (event: Event) => event.preventDefault();
    element.addEventListener('wheel', wheel, { passive: false });
    element.addEventListener('pointerdown', down);
    element.addEventListener('pointermove', move);
    element.addEventListener('pointerup', up);
    element.addEventListener('pointercancel', up);
    element.addEventListener('lostpointercapture', up);
    element.addEventListener('contextmenu', context);
    return () => {
      element.removeEventListener('wheel', wheel); element.removeEventListener('pointerdown', down);
      element.removeEventListener('pointermove', move); element.removeEventListener('pointerup', up);
      element.removeEventListener('pointercancel', up); element.removeEventListener('lostpointercapture', up);
      element.removeEventListener('contextmenu', context);
    };
  }, [interactive]);
  return ref;
}
