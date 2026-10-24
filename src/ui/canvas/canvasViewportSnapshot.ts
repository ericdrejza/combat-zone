import type { CanvasSize } from '@core/layout/polygonCanvasBounds';

export type CanvasViewportSnapshot = {
  zoom: number;
  viewportSize: CanvasSize;
  scrollLeft: number;
  scrollTop: number;
};

/** Read-only render snapshots are published after scale and compensating scroll commit together. */
export function createCanvasViewportSnapshot() {
  let snapshot: CanvasViewportSnapshot = { zoom: 1, viewportSize: { width: 0, height: 0 }, scrollLeft: 0, scrollTop: 0 };
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    publish: (next: CanvasViewportSnapshot) => {
      if (snapshot.zoom === next.zoom && snapshot.scrollLeft === next.scrollLeft && snapshot.scrollTop === next.scrollTop &&
        snapshot.viewportSize.width === next.viewportSize.width && snapshot.viewportSize.height === next.viewportSize.height) return;
      snapshot = next;
      listeners.forEach(listener => listener());
    }
  };
}

export type CanvasViewportSnapshotSource = ReturnType<typeof createCanvasViewportSnapshot>;
