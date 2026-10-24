import { createContext, useContext, useEffect, useState, type PropsWithChildren, type Dispatch, type SetStateAction } from 'react';
import { createPortal } from 'react-dom';
import { usePanelPopout } from '@hooks/usePanelPopout';
import { useCanvasPreferences } from '@ui/canvas_preferences/useCanvasPreferences';
import { matchesKeybind, useKeybinds } from '@ui/keybinds';
import { ignoreShortcut } from '@ui/keybinds/keyboardGuards';
import type { CanvasSize } from '@core/layout/polygonCanvasBounds';
import { PlayerProjection } from './PlayerProjection';
import { PlayerFullscreenButton } from './PlayerFullscreenButton';
import { usePlayerCamera } from './usePlayerCamera';
import { normalizePlayerAspectRatio, playerProjectionSize } from './playerAspectRatio';
import { usePlayerFullscreen, type PlayerFullscreen } from './usePlayerFullscreen';

type PlayerView = {
  zoomOptionsOpen: boolean; setZoomOptionsOpen: Dispatch<SetStateAction<boolean>>;
  zoomOptionsPinned: boolean; setZoomOptionsPinned: Dispatch<SetStateAction<boolean>>;
  preview: boolean; togglePreview: () => void; popoutOpen: boolean; togglePopout: () => void;
  resolution: CanvasSize; aspectRatio: CanvasSize; setAspectRatio: (ratio: CanvasSize) => void;
  fullscreen: PlayerFullscreen;
  camera: ReturnType<typeof usePlayerCamera>;
};
const Context = createContext<PlayerView | null>(null);

/** One shared session controls both outputs; the popup is a portal, never another application/writer. */
export function PlayerViewProvider({ children }: PropsWithChildren) {
  const { preferences } = useCanvasPreferences();
  const [override, setOverride] = useState<CanvasSize | null>(null);
  const aspectRatio = override ?? preferences.playerAspectRatio;
  const resolution = playerProjectionSize(aspectRatio);
  const [preview, setPreview] = useState(false);
  const [zoomOptionsOpen, setZoomOptionsOpen] = useState(false);
  const [zoomOptionsPinned, setZoomOptionsPinned] = useState(false);
  const camera = usePlayerCamera(resolution);
  const { popup, root, toggle } = usePanelPopout('player', 'Player view', 960);
  const fullscreen = usePlayerFullscreen(popup?.document ?? null);
  const { bindings } = useKeybinds();
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (event.repeat || event.isComposing || ignoreShortcut(event, true)) return;
      if (matchesKeybind(event, bindings['player.preview'])) { event.preventDefault(); setPreview(value => !value); }
      else if (matchesKeybind(event, bindings['player.popout'])) { event.preventDefault(); toggle(); }
    };
    window.addEventListener('keydown', handle);
    popup?.addEventListener('keydown', handle);
    return () => { window.removeEventListener('keydown', handle); popup?.removeEventListener('keydown', handle); };
  }, [bindings, popup, toggle]);
  return <Context.Provider value={{ zoomOptionsOpen, setZoomOptionsOpen, zoomOptionsPinned, setZoomOptionsPinned, preview, togglePreview: () => setPreview(value => !value),
    popoutOpen: Boolean(popup), togglePopout: toggle, fullscreen, resolution, aspectRatio,
    setAspectRatio: ratio => setOverride(normalizePlayerAspectRatio(ratio)), camera }}>
    {children}
    {root ? createPortal(<main className="relative flex h-dvh w-screen flex-col overflow-hidden bg-black text-canvas-ink">
      <PlayerProjection camera={camera} resolution={resolution} />
      <PlayerFullscreenButton control={fullscreen} />
    </main>, root) : null}
  </Context.Provider>;
}

export function usePlayerView() {
  const value = useContext(Context);
  if (!value) throw new Error('Player view requires PlayerViewProvider.');
  return value;
}

export function useOptionalPlayerView() { return useContext(Context); }
