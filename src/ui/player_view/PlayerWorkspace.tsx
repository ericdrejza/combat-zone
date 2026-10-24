import { useEffect, useRef, type PropsWithChildren } from 'react';
import { X } from 'lucide-react';
import { CanvasViewportContext } from '@ui/canvas/CanvasViewportContext';
import { CanvasZoomControls } from '@ui/toolbar/CanvasZoomControls';
import { ToolbarOptionButton } from '@ui/toolbar/ToolbarOption';
import { matchesKeybind, useKeybinds, type KeybindActionId } from '@ui/keybinds';
import { ignoreShortcut } from '@ui/keybinds/keyboardGuards';
import { usePlayerView } from './PlayerViewProvider';
import { PlayerProjection } from './PlayerProjection';
import { PlayerAspectRatioControl } from './PlayerAspectRatioControl';
import { PlayerFullscreenButton } from './PlayerFullscreenButton';


function PlayerNavigation() {
  const { camera, togglePreview, aspectRatio, setAspectRatio, fullscreen } = usePlayerView();
  const { bindings } = useKeybinds();
  const viewport = camera.viewport;
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (event.isComposing || ignoreShortcut(event, true)) return;
      const commands: Partial<Record<KeybindActionId, () => void>> = {
        'viewport.zoomIn': viewport.zoomIn, 'viewport.zoomOut': viewport.zoomOut,
        'viewport.fit': viewport.zoomToFit, 'viewport.fitWidth': viewport.zoomToFitWidth,
        'viewport.fitHeight': viewport.zoomToFitHeight, 'viewport.reset': viewport.resetZoom,
        'viewport.panUp': () => viewport.pan('up'), 'viewport.panDown': () => viewport.pan('down'),
        'viewport.panLeft': () => viewport.pan('left'), 'viewport.panRight': () => viewport.pan('right')
      };
      const id = (Object.keys(commands) as KeybindActionId[]).find(id => matchesKeybind(event, bindings[id]));
      if (id) { event.preventDefault(); commands[id]?.(); }
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [viewport, bindings]);
  return <header aria-label="Player preview controls" className="flex flex-wrap items-center gap-2 border-b border-canvas-line bg-canvas-panel p-2 text-canvas-ink">
    <ToolbarOptionButton aria-label="Exit player preview" onClick={togglePreview}><X size={18} aria-hidden="true" /></ToolbarOptionButton>
    <PlayerAspectRatioControl value={aspectRatio} onChange={setAspectRatio} />
    <PlayerFullscreenButton control={fullscreen} inline />
    <div className="ml-auto flex min-w-0 max-w-full flex-wrap items-center justify-end gap-2">
      <CanvasViewportContext.Provider value={viewport}><CanvasZoomControls inline /></CanvasViewportContext.Provider>
    </div>
  </header>;
}

/** Visibility preserves GM layout measurements and gesture ownership while removing editor access. */
export function PlayerWorkspace({ children }: PropsWithChildren) {
  const player = usePlayerView();
  const editor = useRef<HTMLDivElement>(null);
  useEffect(() => { if (editor.current) editor.current.inert = player.preview; }, [player.preview]);
  return <div className="relative flex min-h-0 flex-1 flex-col">
    <div ref={editor} aria-hidden={player.preview || undefined} className="flex min-h-0 flex-1 flex-col" style={{ visibility: player.preview ? 'hidden' : undefined }}>{children}</div>
    {player.preview ? <section aria-label="Player preview" data-player-preview className="absolute inset-0 z-50 flex flex-col overflow-hidden bg-black">
      <PlayerNavigation />
      <PlayerProjection camera={player.camera} resolution={player.resolution} interactive />
    </section> : null}
  </div>;
}
