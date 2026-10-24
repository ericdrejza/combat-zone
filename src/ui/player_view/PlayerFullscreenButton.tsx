import { Maximize, Minimize } from 'lucide-react';
import { ToolbarOptionButton } from '@ui/toolbar/ToolbarOption';
import type { PlayerFullscreen } from './usePlayerFullscreen';

/** Use the projected window's document, including browser-initiated fullscreen exits. */
export function PlayerFullscreenButton({ control, inline = false }: { control: PlayerFullscreen; inline?: boolean }) {
  const { ownerDocument, fullscreen, supported, automaticAllowed, pending, error, toggle } = control;
  return <div className={inline ? 'relative flex shrink-0 flex-col items-start' : 'absolute right-2 top-2 z-10 flex max-w-[calc(100%-1rem)] flex-col items-end gap-2'}>
    <ToolbarOptionButton disabled={!supported} aria-label={!ownerDocument ? 'Open the player window to use fullscreen' : !supported ? 'Fullscreen unavailable in this browser' : fullscreen ? 'Exit player window fullscreen' : inline && !automaticAllowed ? 'Focus player window, then press Enter or Spacebar for fullscreen' : 'Enter player window fullscreen'}
      aria-pressed={fullscreen} onClick={() => { void toggle(inline); }}>
      {fullscreen ? <Minimize size={18} aria-hidden="true" /> : <Maximize size={18} aria-hidden="true" />}
    </ToolbarOptionButton>
    {pending || error ? <p role={error ? 'alert' : 'status'} aria-label={error ? 'Player window fullscreen error' : 'Player window fullscreen status'} className={`${inline ? 'fixed inset-x-2 bottom-2 z-50 mx-auto' : ''} max-w-xs rounded-lg bg-canvas-panel p-2 text-sm text-canvas-ink shadow-lg`}>
      {error ? 'The browser could not change fullscreen mode. Try the fullscreen control again.' : 'Press Enter or Spacebar for player-window fullscreen. Escape cancels.'}
    </p> : null}
  </div>;
}
