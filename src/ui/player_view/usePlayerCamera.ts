import { useCanvasViewportSnapshot } from '@ui/canvas/useCanvasViewportSnapshot';
import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '@store/store';
import type { CanvasSize } from '@core/layout/polygonCanvasBounds';
import type { LayoutPoint } from '@core/layout/types';
import { useCanvasViewport, type CanvasViewportValue } from '@ui/canvas/CanvasViewportContext';
import { clampZoom, CANVAS_ZOOM_STEP } from '@ui/canvas/canvasViewportMath';
import { clampPlayerRegion, visibleCanvasRegion, type PlayerRegion } from './playerCamera';

/** Project one committed GM camera snapshot; independent navigation stays session-only. */
export function usePlayerCamera(resolution: CanvasSize) {
  const gm = useCanvasViewport();
  const encounter = useSelector((state: RootState) => state.encounter.present);
  const canvas = encounter.canvasSize;
  const snapshot = useCanvasViewportSnapshot();
  const readGM = (): PlayerRegion => {
    const measured = snapshot.viewportSize;
    const size = measured.width > 0 && measured.height > 0 ? measured : canvas;
    return visibleCanvasRegion(canvas, size, snapshot.zoom, snapshot.scrollLeft, snapshot.scrollTop);
  };
  const [freeCamera, setFreeCamera] = useState<{ region: PlayerRegion; zoom: number } | null>(null);
  const previousDocument = useRef({ id: encounter.id, canvas });

  useEffect(() => {
    const previous = previousDocument.current;
    previousDocument.current = { id: encounter.id, canvas };
    if (previous.id !== encounter.id) setFreeCamera(null);
    else if (previous.canvas.width !== canvas.width || previous.canvas.height !== canvas.height) {
      setFreeCamera(current => {
        if (!current) return current;
        const { region } = current;
        return { ...current, region: clampPlayerRegion({ ...region,
          x: (region.x + region.width / 2) / previous.canvas.width * canvas.width - region.width / 2,
          y: (region.y + region.height / 2) / previous.canvas.height * canvas.height - region.height / 2
        }, canvas) };
      });
    }
  }, [encounter.id, canvas]);

  const following = freeCamera === null;
  const region = freeCamera?.region ?? readGM();
  const zoom = freeCamera?.zoom ?? snapshot.zoom;

  const panBy = (x: number, y: number) => {
    if (following) {
      gm.stopPanAnimation();
      if (gm.element) { gm.element.scrollLeft += x * snapshot.zoom; gm.element.scrollTop += y * snapshot.zoom; }
    } else setFreeCamera(current => current && { ...current, region: clampPlayerRegion({ ...current.region, x: current.region.x + x, y: current.region.y + y }, canvas) });
  };
  const zoomAt = (requested: number, point?: LayoutPoint, destination?: LayoutPoint) => {
    const anchor = point ?? { x: region.x + region.width / 2, y: region.y + region.height / 2 };
    const target = destination ?? anchor;
    if (following) {
      const size = snapshot.viewportSize;
      gm.setZoomAtPoint(requested, {
        x: (target.x - region.x) / region.width * size.width,
        y: (target.y - region.y) / region.height * size.height
      }, anchor);
    } else setFreeCamera(current => {
      if (!current) return current;
      const nextZoom = clampZoom(requested), ratio = current.zoom / nextZoom;
      const r = current.region;
      const fraction = { x: (target.x - region.x) / region.width, y: (target.y - region.y) / region.height };
      const origin = point ?? { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      return { zoom: nextZoom, region: clampPlayerRegion({ x: origin.x - fraction.x * r.width * ratio,
        y: origin.y - fraction.y * r.height * ratio, width: r.width * ratio, height: r.height * ratio }, canvas) };
    });
  };
  // Relative commands compose before React renders, just like the GM's zoomRef/pending scroll.
  const zoomBy = (delta: number, point?: LayoutPoint) => {
    const fraction = point ? { x: (point.x - region.x) / region.width, y: (point.y - region.y) / region.height } : { x: 0.5, y: 0.5 };
    if (following) {
      gm.zoomByWheelAtPoint(-delta, { x: fraction.x * snapshot.viewportSize.width, y: fraction.y * snapshot.viewportSize.height });
    } else setFreeCamera(current => {
      if (!current) return current;
      const nextZoom = clampZoom(current.zoom + delta), ratio = current.zoom / nextZoom;
      const r = current.region;
      return { zoom: nextZoom, region: clampPlayerRegion({
        x: r.x + fraction.x * r.width * (1 - ratio), y: r.y + fraction.y * r.height * (1 - ratio),
        width: r.width * ratio, height: r.height * ratio
      }, canvas) };
    });
  };
  const fit = (axis?: 'width' | 'height') => {
    if (following) { if (axis === 'width') gm.zoomToFitWidth(); else if (axis === 'height') gm.zoomToFitHeight(); else gm.zoomToFit(); return; }
    const nextZoom = clampZoom(axis ? resolution[axis] / canvas[axis]
      : Math.min(resolution.width / canvas.width, resolution.height / canvas.height));
    setFreeCamera({ zoom: nextZoom, region: clampPlayerRegion({ x: (canvas.width - resolution.width / nextZoom) / 2,
      y: (canvas.height - resolution.height / nextZoom) / 2,
      width: resolution.width / nextZoom, height: resolution.height / nextZoom }, canvas) });
  };
  const viewport: CanvasViewportValue = {
    ...gm, zoom, viewportSize: resolution, getViewportSize: () => resolution,
    pan: direction => panBy(direction === 'left' ? -40 / zoom : direction === 'right' ? 40 / zoom : 0,
      direction === 'up' ? -40 / zoom : direction === 'down' ? 40 / zoom : 0),
    zoomIn: following ? gm.zoomIn : () => zoomBy(CANVAS_ZOOM_STEP),
    zoomOut: following ? gm.zoomOut : () => zoomBy(-CANVAS_ZOOM_STEP),
    resetZoom: following ? gm.resetZoom : () => zoomAt(1), zoomToFit: () => fit(),
    zoomToFitWidth: () => fit('width'), zoomToFitHeight: () => fit('height')
  };
  return { region, following, viewport, panBy, zoomAt, zoomBy,
    toggleFollow: () => setFreeCamera(current => current ? null : { region: readGM(), zoom: snapshot.zoom }) };
}
