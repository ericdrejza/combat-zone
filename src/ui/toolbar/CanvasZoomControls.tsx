import { MousePointer2, Scan, SearchSlash, ZoomIn, ZoomOut } from "lucide-react";

import { useCanvasViewport } from "@ui/canvas/CanvasViewportContext";
import { ToolbarOptionButton, ToolbarOptionGroup } from "./ToolbarOption";

export function CanvasZoomControls() {
  const viewport = useCanvasViewport();

  return (
    <ToolbarOptionGroup aria-label="Canvas navigation">
      <output
        aria-label="Current zoom"
        className="min-w-12 self-center text-center text-xs tabular-nums text-canvas-muted"
      >
        {Math.round(viewport.zoom * 100)}%
      </output>
      <ToolbarOptionButton aria-label="Zoom to fit" onClick={viewport.zoomToFit} title="Zoom to fit" type="button">
        <Scan aria-hidden="true" className="h-4 w-4" />
      </ToolbarOptionButton>
      <ToolbarOptionButton aria-label="Zoom out" disabled={viewport.zoom <= 0.2} onClick={viewport.zoomOut} title="Zoom out" type="button">
        <ZoomOut aria-hidden="true" className="h-4 w-4" />
      </ToolbarOptionButton>
      <ToolbarOptionButton aria-label="Zoom in" disabled={viewport.zoom >= 4} onClick={viewport.zoomIn} title="Zoom in" type="button">
        <ZoomIn aria-hidden="true" className="h-4 w-4" />
      </ToolbarOptionButton>
      <ToolbarOptionButton aria-label="Reset zoom" onClick={viewport.resetZoom} title="Reset zoom" type="button">
        <SearchSlash aria-hidden="true" className="h-4 w-4" />
      </ToolbarOptionButton>
      <ToolbarOptionButton active={viewport.panEnabled} aria-label="Pan with right drag" aria-pressed={viewport.panEnabled} onClick={() => viewport.setPanEnabled(!viewport.panEnabled)} title="Pan with right drag" type="button">
        <MousePointer2 aria-hidden="true" className="h-4 w-4" />
      </ToolbarOptionButton>
    </ToolbarOptionGroup>
  );
}
