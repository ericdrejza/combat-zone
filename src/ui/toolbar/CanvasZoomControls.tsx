import {
  ChevronDown,
  ChevronRight,
  MoveHorizontal,
  MoveVertical,
  Scan,
  Search,
  SearchSlash,
  ZoomIn,
  ZoomOut
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useCanvasViewport } from "@ui/canvas/CanvasViewportContext";
import {
  ToolbarOptionButton,
  ToolbarOptionGroup,
  ToolbarSubtoolBar
} from "./ToolbarOption";
import { TouchTooltip } from "./TouchTooltip";

type CanvasZoomControlsProps = {
  compactOpen?: boolean;
  compactSubtoolHost?: HTMLDivElement | null;
  onCompactToggle?: () => void;
};

function ZoomOptionsControl({
  onFitHeight,
  onFitWidth,
  onReset
}: {
  onFitHeight: () => void;
  onFitWidth: () => void;
  onReset: () => void;
}) {
  const [trayOpen, setTrayOpen] = useState(false);
  const [trayPinned, setTrayPinned] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const trayRef = useRef<HTMLDivElement | null>(null);
  const [trayPosition, setTrayPosition] = useState({ right: 0, top: 0 });

  function clearClose() {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
  }

  function openTray() {
    clearClose();
    const bounds = triggerRef.current?.getBoundingClientRect();
    if (bounds) {
      setTrayPosition({
        right: document.documentElement.clientWidth - bounds.right,
        top: bounds.bottom + 4
      });
    }
    setTrayOpen(true);
  }

  function scheduleClose() {
    if (trayPinned) return;
    clearClose();
    closeTimerRef.current = setTimeout(() => {
      setTrayOpen(false);
      closeTimerRef.current = null;
    }, 100);
  }

  useEffect(
    () => () => {
      clearClose();
    },
    []
  );

  useEffect(() => {
    if (!trayPinned) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Node &&
        (triggerRef.current?.contains(target) || trayRef.current?.contains(target))
      ) {
        return;
      }
      clearClose();
      setTrayPinned(false);
      setTrayOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [trayPinned]);

  const tray = (
    <AnimatePresence>
      {trayOpen ? (
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          aria-label="Zoom to fit options"
          className="fixed z-[90] flex gap-1 rounded-full border border-canvas-line bg-canvas-surface/95 p-1 shadow-lg"
          exit={{ opacity: 0, y: -4 }}
          initial={{ opacity: 0, y: -4 }}
          onPointerEnter={clearClose}
          onPointerLeave={(event) => {
            if (event.pointerType !== "touch") scheduleClose();
          }}
          ref={trayRef}
          role="toolbar"
          style={trayPosition}
          transition={{ duration: 0.12, ease: "easeOut" }}
        >
          <ToolbarOptionButton aria-label="Zoom to fit width" onClick={onFitWidth} title="Zoom to fit width" type="button">
            <MoveHorizontal aria-hidden="true" className="h-4 w-4" />
          </ToolbarOptionButton>
          <ToolbarOptionButton aria-label="Zoom to fit height" onClick={onFitHeight} title="Zoom to fit height" type="button">
            <MoveVertical aria-hidden="true" className="h-4 w-4" />
          </ToolbarOptionButton>
          <ToolbarOptionButton aria-label="Reset zoom" onClick={onReset} title="Reset zoom" type="button">
            <SearchSlash aria-hidden="true" className="h-4 w-4" />
          </ToolbarOptionButton>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );

  return (
    <div
      className="inline-flex"
      onPointerDown={(event) => {
        if (event.pointerType === "touch") openTray();
      }}
      onPointerEnter={(event) => {
        if (event.pointerType !== "touch") openTray();
      }}
      onPointerLeave={(event) => {
        if (event.pointerType !== "touch") scheduleClose();
      }}
      ref={triggerRef}
    >
      <ToolbarOptionButton
        active={trayPinned}
        aria-expanded={trayOpen}
        aria-label="More zoom options"
        onClick={() => {
          if (trayPinned) {
            clearClose();
            setTrayPinned(false);
            setTrayOpen(false);
          } else {
            openTray();
            setTrayPinned(true);
          }
        }}
        title="More zoom options"
        type="button"
      >
        <ChevronDown aria-hidden="true" className="h-4 w-4" />
      </ToolbarOptionButton>
      {createPortal(tray, document.body)}
    </div>
  );
}

export function CanvasZoomControls({
  compactOpen = false,
  compactSubtoolHost = null,
  onCompactToggle
}: CanvasZoomControlsProps) {
  const viewport = useCanvasViewport();
  const [desktopExpanded, setDesktopExpanded] = useState(true);

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
        <ToolbarOptionButton aria-label="Zoom out" disabled={viewport.zoom <= 0.2} onClick={viewport.zoomOut} title="Zoom out" type="button">
          <ZoomOut aria-hidden="true" className="h-4 w-4" />
        </ToolbarOptionButton>
        <ToolbarOptionButton aria-label="Zoom in" disabled={viewport.zoom >= 4} onClick={viewport.zoomIn} title="Zoom in" type="button">
          <ZoomIn aria-hidden="true" className="h-4 w-4" />
        </ToolbarOptionButton>
        <ZoomOptionsControl
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
      <ToolbarOptionGroup aria-label="Canvas navigation" className="hidden lg:flex">
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
