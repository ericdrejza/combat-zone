import { useEffect } from "react";

import type { PanelLayout } from "./panelLayout";
import type { DropTarget } from "./PanelsShell";
import { resolvePanelPointerDropTarget } from "./panelPointerDrag";

/** Outside a dock, native drops return home, so their preview must return home too. */
export function usePanelNativeDragPreview(
  panelId: string | null,
  layout: PanelLayout,
  onPreviewDrop: (target: DropTarget) => void
) {
  useEffect(() => {
    if (!panelId) return;
    const side = layout.left.some(panel => panel.id === panelId) ? "left" : "right";
    const index = layout[side].findIndex(panel => panel.id === panelId);
    if (index < 0) return;
    const originalTarget: DropTarget = { side, index };
    function preview(event: DragEvent) {
      onPreviewDrop(resolvePanelPointerDropTarget(
        event.clientX, event.clientY,
        event.target instanceof Element ? event.target : null
      ) ?? originalTarget);
    }
    window.addEventListener("dragover", preview, true);
    return () => window.removeEventListener("dragover", preview, true);
  }, [panelId, layout, onPreviewDrop]);
}
