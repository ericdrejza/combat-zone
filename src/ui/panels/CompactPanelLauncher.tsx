import { AnimatePresence, motion } from "motion/react";
import type {
  KeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode
} from "react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  COMPACT_PANEL_DEFINITIONS,
  type CompactPanelDefinition,
  type CompactPanelId
} from "./compactPanelMetadata";
import { CompactPanelDrawer } from "./CompactPanelDrawer";
import { CompactPanelMenu } from "./CompactPanelMenu";
import { COMPACT_CANVAS_TRANSFER_EVENT } from "../canvas/compactCanvasTransfer";

const HOLD_DURATION_MS = 500;

export type CompactPanelLauncherProps = {
  /** Content for each panel. Keeping this callback in the shell avoids coupling it to Redux. */
  inline?: boolean;
  overlayContainer?: Element | null;
  renderPanelContent?: (panel: CompactPanelDefinition) => ReactNode;
  renderPanelHeaderActions?: (panel: CompactPanelDefinition) => ReactNode;
  onPanelChange?: (panelId: CompactPanelId) => void;
  onDrawerChange?: (open: boolean) => void;
  selectedPanelId?: CompactPanelId;
  panels?: readonly CompactPanelDefinition[];
};

/**
 * Mobile panel affordance. The launcher is intentionally mounted independently
 * from the desktop docks so responsive layout changes do not alter panel state
 * or the panel content contract.
 */
export function CompactPanelLauncher({
  inline = false,
  onDrawerChange,
  onPanelChange,
  panels = COMPACT_PANEL_DEFINITIONS,
  renderPanelContent,
  renderPanelHeaderActions,
  overlayContainer,
  selectedPanelId: controlledSelectedPanelId
}: CompactPanelLauncherProps) {
  const [internalSelectedPanelId, setInternalSelectedPanelId] =
    useState<CompactPanelId>("library");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);
  const [keyboardMenuOpen, setKeyboardMenuOpen] = useState(false);
  const selectedPanelId = controlledSelectedPanelId ?? internalSelectedPanelId;
  const selectedPanel =
    panels.find((panel) => panel.id === selectedPanelId) ?? panels[0];
  const launcherRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const holdActiveRef = useRef(false);
  const suppressClickRef = useRef(false);

  const setDrawer = useCallback(
    (open: boolean) => {
      setDrawerOpen(open);
      onDrawerChange?.(open);
      if (!open) {
        requestAnimationFrame(() => launcherRef.current?.focus());
      }
    },
    [onDrawerChange]
  );

  const selectPanel = useCallback(
    (panelId: CompactPanelId) => {
      if (!controlledSelectedPanelId) {
        setInternalSelectedPanelId(panelId);
      }
      onPanelChange?.(panelId);
    },
    [controlledSelectedPanelId, onPanelChange]
  );

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    setKeyboardMenuOpen(false);
    setHighlightedIndex(null);
  }, []);

  const finishPointer = useCallback(
    () => {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
      if (holdActiveRef.current) {
        suppressClickRef.current = true;
        // A pointer release on the launcher may still dispatch a click after
        // this callback. Clear the guard after that browser event has run so
        // keyboard activation cannot be swallowed by a previous hold.
        setTimeout(() => {
          suppressClickRef.current = false;
        }, 0);
      } else {
        suppressClickRef.current = true;
        setDrawer(!drawerOpen);
      }
      holdActiveRef.current = false;
      pointerIdRef.current = null;
    },
    [drawerOpen, setDrawer]
  );

  useEffect(() => {
    const onPointerUp = (event: PointerEvent) => {
      if (
        pointerIdRef.current === null ||
        event.pointerId !== pointerIdRef.current
      ) {
        return;
      }
      finishPointer();
    };
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [finishPointer]);

  useLayoutEffect(() => {
    if (!keyboardMenuOpen) {
      return;
    }
    const selectedIndex = panels.findIndex((panel) => panel.id === selectedPanelId);
    const focusIndex = selectedIndex >= 0 ? selectedIndex : 0;
    menuRef.current
      ?.querySelectorAll<HTMLButtonElement>("[data-compact-panel-item]")
      .item(focusIndex)?.focus();
  }, [keyboardMenuOpen, panels, selectedPanelId]);

  useEffect(() => {
    function onDocumentKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        if (menuOpen) {
          event.preventDefault();
          closeMenu();
        } else if (drawerOpen) {
          event.preventDefault();
          setDrawer(false);
        }
      }
    }
    document.addEventListener("keydown", onDocumentKeyDown);
    return () => document.removeEventListener("keydown", onDocumentKeyDown);
  }, [closeMenu, drawerOpen, menuOpen, setDrawer]);

  useEffect(() => {
    const closeForCanvasTransfer = () => {
      closeMenu();
      setDrawer(false);
    };
    window.addEventListener(
      COMPACT_CANVAS_TRANSFER_EVENT,
      closeForCanvasTransfer
    );
    return () =>
      window.removeEventListener(
        COMPACT_CANVAS_TRANSFER_EVENT,
        closeForCanvasTransfer
      );
  }, [closeMenu, setDrawer]);

  function openKeyboardMenu() {
    setMenuOpen(true);
    setKeyboardMenuOpen(true);
    setHighlightedIndex(
      Math.max(0, panels.findIndex((panel) => panel.id === selectedPanelId))
    );
  }

  function onLauncherPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) {
      return;
    }
    pointerIdRef.current = event.pointerId;
    holdActiveRef.current = false;
    holdTimerRef.current = setTimeout(() => {
      holdActiveRef.current = true;
      setMenuOpen(true);
      setKeyboardMenuOpen(false);
    }, HOLD_DURATION_MS);
  }

  function onLauncherKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      openKeyboardMenu();
    } else if (event.key === "Escape" && (drawerOpen || menuOpen)) {
      event.preventDefault();
      if (menuOpen) {
        closeMenu();
      } else {
        setDrawer(false);
      }
    }
  }

  function onLauncherClick() {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    // Pointer events perform the short-tap action. This also supports keyboard activation.
    if (pointerIdRef.current === null) {
      setDrawer(!drawerOpen);
    }
  }

  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu();
      launcherRef.current?.focus();
      return;
    }
    if (event.key === "Enter" && highlightedIndex !== null && panels[highlightedIndex]) {
      event.preventDefault();
      selectPanel(panels[highlightedIndex].id);
      closeMenu();
      launcherRef.current?.focus();
      return;
    }
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") {
      return;
    }
    event.preventDefault();
    const current = highlightedIndex ?? panels.findIndex((panel) => panel.id === selectedPanelId);
    const direction = event.key === "ArrowDown" ? 1 : -1;
    const next = (Math.max(0, current) + direction + panels.length) % panels.length;
    setHighlightedIndex(next);
    menuRef.current
      ?.querySelectorAll<HTMLButtonElement>("[data-compact-panel-item]")
      .item(next)?.focus();
  }

  if (!selectedPanel) {
    return null;
  }

  const launcherButton = (
    <button
      ref={launcherRef}
      aria-expanded={drawerOpen}
      aria-haspopup="dialog"
      aria-label={`${selectedPanel.title} panel`}
      className={`${inline ? "relative z-40" : "pointer-events-auto absolute bottom-3 right-2"} flex h-11 w-11 items-center justify-center rounded-full border shadow-lg transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-canvas-ink ${
        drawerOpen
          ? "border-canvas-ink bg-canvas-ink text-white hover:bg-canvas-ink/90"
          : "border-canvas-line bg-canvas-panel text-canvas-ink hover:bg-white"
      }`}
      onClick={onLauncherClick}
      onKeyDown={onLauncherKeyDown}
      onPointerDown={onLauncherPointerDown}
      onPointerUp={finishPointer}
      onPointerCancel={finishPointer}
      type="button"
    >
      <selectedPanel.Icon aria-hidden="true" className="h-5 w-5" />
      <span className="sr-only">{selectedPanel.title}</span>
    </button>
  );

  const launcherOverlay = (
    <div className="pointer-events-none absolute inset-0 z-40" data-compact-panels>
      <AnimatePresence>
        {drawerOpen ? (
          <motion.button
            aria-label="Close panel drawer"
            className="pointer-events-auto absolute inset-0 bg-black/20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDrawer(false)}
            onPointerDown={() => setDrawer(false)}
            tabIndex={-1}
            type="button"
          />
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {drawerOpen ? (
          <CompactPanelDrawer
            onClose={() => setDrawer(false)}
            panel={selectedPanel}
            renderPanelContent={renderPanelContent}
            renderPanelHeaderActions={renderPanelHeaderActions}
          />
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {menuOpen ? (
          <motion.button
            aria-label="Dismiss panel chooser"
            className="pointer-events-auto absolute inset-0 bg-transparent"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeMenu}
            onPointerDown={closeMenu}
            tabIndex={-1}
            type="button"
          />
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {menuOpen ? (
          <div>
            <CompactPanelMenu
              highlightedIndex={highlightedIndex}
              menuRef={menuRef}
              onClose={() => {
                closeMenu();
                launcherRef.current?.focus();
              }}
              onKeyDown={onMenuKeyDown}
              onPanelHover={setHighlightedIndex}
              onPanelSelect={selectPanel}
              panels={panels}
              selectedPanelId={selectedPanelId}
            />
          </div>
        ) : null}
      </AnimatePresence>
    </div>
  );

  const renderedOverlay = inline
    ? overlayContainer
      ? createPortal(launcherOverlay, overlayContainer)
      : null
    : launcherOverlay;

  return (
    <>
      {renderedOverlay}
      {launcherButton}
    </>
  );
}
