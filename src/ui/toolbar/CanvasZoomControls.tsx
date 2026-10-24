import { useOptionalPlayerView } from '@ui/player_view/PlayerViewProvider';
import { ZoomOptionsControl } from './ZoomOptionsControl';
import {
  ChevronRight,
  Scan,
  Search,
  ZoomIn,
  ZoomOut
} from "lucide-react";
import { useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";

import { useCanvasViewport } from "@ui/canvas/CanvasViewportContext";
import {
  ToolbarOptionButton,
  ToolbarOptionGroup,
  ToolbarSubtoolBar
} from "./ToolbarOption";
import { TouchTooltip } from "./TouchTooltip";

type CanvasZoomControlsProps = {
  inline?: boolean;
  compactOpen?: boolean;
  compactSubtoolHost?: HTMLDivElement | null;
  onCompactToggle?: () => void;
};

export function CanvasZoomControls({
  inline = false,
  compactOpen = false,
  compactSubtoolHost = null,
  onCompactToggle
}: CanvasZoomControlsProps) {
  const viewport = useCanvasViewport();
  const player = useOptionalPlayerView();
  const [desktopExpanded, setDesktopExpanded] = useState(true);
  useLayoutEffect(() => { if (player?.zoomOptionsOpen) setDesktopExpanded(true); }, [player?.zoomOptionsOpen]);

  function renderControls() {
    return (
      <>
        <output
          aria-label="Current zoom"
          className="min-w-12 self-center text-center text-xs tabular-nums text-canvas-muted"
        >
          {Math.round(viewport.zoom * 100)}%
        </output>
        <ToolbarOptionButton aria-label="Zoom to fit" onClick={viewport.zoomToFit} title="Zoom to fit" type="button">
          <Scan aria-hidden="true" className="h-4 w-4" />
        </ToolbarOptionButton>
        <ToolbarOptionButton repeat aria-label="Zoom out" disabled={viewport.zoom <= 0.2} onClick={viewport.zoomOut} title="Zoom out" type="button">
          <ZoomOut aria-hidden="true" className="h-4 w-4" />
        </ToolbarOptionButton>
        <ToolbarOptionButton repeat aria-label="Zoom in" disabled={viewport.zoom >= 4} onClick={viewport.zoomIn} title="Zoom in" type="button">
          <ZoomIn aria-hidden="true" className="h-4 w-4" />
        </ToolbarOptionButton>
        <ZoomOptionsControl
          previewNavigation={inline}
          onFitHeight={viewport.zoomToFitHeight}
          onFitWidth={viewport.zoomToFitWidth}
          onReset={viewport.resetZoom}
        />
      </>
    );
  }

  const compactOptions = compactOpen ? (
    <ToolbarSubtoolBar aria-label="Canvas navigation options">
      <ToolbarOptionGroup aria-label="Canvas navigation">
        {renderControls()}
      </ToolbarOptionGroup>
    </ToolbarSubtoolBar>
  ) : null;

  return (
    <>
      {onCompactToggle ? (
        <div className="lg:hidden">
          <TouchTooltip label="Zoom controls">
            <button
              aria-expanded={compactOpen}
              aria-label="Zoom controls"
              aria-pressed={compactOpen}
              className={`flex h-11 min-w-11 items-center justify-center rounded-full border shadow-sm transition ${
                compactOpen
                  ? "border-canvas-ink bg-canvas-ink text-canvas-on-ink"
                  : "border-canvas-line bg-canvas-surface text-canvas-ink hover:bg-canvas"
              }`}
              onClick={onCompactToggle}
              title="Zoom controls"
              type="button"
            >
              <Search aria-hidden="true" className="h-5 w-5" />
            </button>
          </TouchTooltip>
        </div>
      ) : null}
      {!onCompactToggle ? (
      <ToolbarOptionGroup aria-label="Canvas navigation" className={inline ? "flex flex-wrap" : "hidden lg:flex"}>
        <ToolbarOptionButton
          aria-expanded={desktopExpanded}
          aria-label={desktopExpanded ? "Collapse canvas navigation" : "Expand canvas navigation"}
          onClick={() => setDesktopExpanded((expanded) => !expanded)}
          title={desktopExpanded ? "Collapse canvas navigation" : "Expand canvas navigation"}
          type="button"
        >
          {desktopExpanded ? (
            <ChevronRight aria-hidden="true" className="h-4 w-4" />
          ) : (
            <Search aria-hidden="true" className="h-4 w-4" />
          )}
        </ToolbarOptionButton>
        {desktopExpanded ? renderControls() : null}
      </ToolbarOptionGroup>
      ) : null}
      {compactSubtoolHost && compactOptions
        ? createPortal(compactOptions, compactSubtoolHost)
        : null}
    </>
  );
}
