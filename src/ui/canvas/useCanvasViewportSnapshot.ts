import { createContext, useCallback, useContext, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { CanvasSize } from '@core/layout/polygonCanvasBounds';
import { createCanvasViewportSnapshot, type CanvasViewportSnapshotSource } from './canvasViewportSnapshot';

export const CanvasViewportSnapshotContext = createContext<CanvasViewportSnapshotSource | null>(null);

/** Call after the viewport's zoom/resize layout effects so subscribers never see half a camera update. */
export function usePublishCanvasViewportSnapshot({ element, zoom, getViewportSize }: {
  element: HTMLDivElement | null; zoom: number; getViewportSize: () => CanvasSize;
}) {
  const [source] = useState(createCanvasViewportSnapshot);
  const committedZoom = useRef(zoom);
  const publish = useCallback(() => source.publish({
    zoom: committedZoom.current, viewportSize: getViewportSize(),
    scrollLeft: element?.scrollLeft ?? 0, scrollTop: element?.scrollTop ?? 0
  }), [source, element, getViewportSize]);
  useLayoutEffect(() => { committedZoom.current = zoom; publish(); });
  useLayoutEffect(() => {
    element?.addEventListener('scroll', publish);
    return () => element?.removeEventListener('scroll', publish);
  }, [element, publish]);
  return source;
}

export function useCanvasViewportSnapshot() {
  const source = useContext(CanvasViewportSnapshotContext);
  if (!source) throw new Error('Viewport snapshots require CanvasViewportProvider.');
  return useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
}
