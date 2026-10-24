import { useOptionalPlayerView } from '@ui/player_view/PlayerViewProvider';
import { ChevronDown, MoveHorizontal, MoveVertical, SearchSlash } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PlayerViewToggles } from '@ui/player_view/PlayerViewToggles';
import { ToolbarOptionButton } from './ToolbarOption';

export function ZoomOptionsControl({
  onFitHeight,
  onFitWidth,
  onReset,
  previewNavigation = false
}: {
  onFitHeight: () => void;
  onFitWidth: () => void;
  onReset: () => void;
  previewNavigation?: boolean;
}) {
  const player = useOptionalPlayerView();
  const [localOpen, setLocalOpen] = useState(false);
  const [localPinned, setLocalPinned] = useState(false);
  const trayOpen = player?.zoomOptionsOpen ?? localOpen;
  const trayPinned = player?.zoomOptionsPinned ?? localPinned;
  const setTrayOpen = player?.setZoomOptionsOpen ?? setLocalOpen;
  const setTrayPinned = player?.setZoomOptionsPinned ?? setLocalPinned;
  const isActive = !player || player.preview === previewNavigation;
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
    setTrayOpen(true);
  }

  // Transfer the open menu to the active header instead of leaving an editor portal behind.
  useLayoutEffect(() => { if (!isActive) clearClose(); }, [isActive]);

  // Both the GM toolbar and compact preview can place the trigger near a screen edge.
  useLayoutEffect(() => {
    if (!trayOpen || !isActive) return;
    const position = () => {
      const trigger = triggerRef.current?.getBoundingClientRect();
      const tray = trayRef.current?.getBoundingClientRect();
      if (!trigger || !tray) return;
      const width = document.documentElement.clientWidth || window.innerWidth;
      const next = {
        right: Math.max(8, Math.min(width - trigger.right, width - tray.width - 8)),
        top: Math.max(8, Math.min(trigger.bottom + 4, window.innerHeight - tray.height - 8))
      };
      setTrayPosition(current => current.right === next.right && current.top === next.top ? current : next);
    };
    position();
    window.addEventListener('resize', position);
    document.addEventListener('scroll', position, true);
    return () => { window.removeEventListener('resize', position); document.removeEventListener('scroll', position, true); };
  }, [trayOpen, isActive]);

  function scheduleClose() {
    if (!isActive || trayPinned) return;
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
    if (!isActive || !trayPinned) return;

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
  }, [trayPinned, isActive]);

  const tray = (
    <AnimatePresence>
      {trayOpen ? (
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          aria-label="Extended zoom options"
          data-toolbar-subtools="true"
          className="fixed z-[90] flex max-w-[calc(100vw-1rem)] flex-wrap gap-1 rounded-full border border-canvas-line bg-canvas-surface/95 p-1 shadow-lg"
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
          <PlayerViewToggles />
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
        active={isActive && trayPinned}
        aria-expanded={isActive && trayOpen}
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
      {isActive ? createPortal(tray, document.body) : null}
    </div>
  );
}
