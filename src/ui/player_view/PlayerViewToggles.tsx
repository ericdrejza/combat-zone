import { Eye, MonitorUp, Link } from 'lucide-react';
import { ToolbarOptionButton } from '@ui/toolbar/ToolbarOption';
import { useOptionalPlayerView } from './PlayerViewProvider';

/** Player controls retain the menu, including across the GM/preview header handoff. */
export function PlayerViewToggles() {
  const player = useOptionalPlayerView();
  if (!player) return null;
  const keepOpen = () => { player.setZoomOptionsOpen(true); player.setZoomOptionsPinned(true); };
  return <>
    <ToolbarOptionButton aria-label="Follow GM view" aria-pressed={player.camera.following} active={player.camera.following}
      onClick={() => { keepOpen(); player.camera.toggleFollow(); }}>
      <Link size={18} aria-hidden="true" />
    </ToolbarOptionButton>
    <ToolbarOptionButton aria-label="Toggle player preview" aria-pressed={player.preview} active={player.preview}
      onClick={() => { keepOpen(); player.togglePreview(); }}><Eye size={18} aria-hidden="true" /></ToolbarOptionButton>
    <ToolbarOptionButton aria-label="Toggle player window" aria-pressed={player.popoutOpen} active={player.popoutOpen}
      onClick={() => { keepOpen(); player.togglePopout(); }}><MonitorUp size={18} aria-hidden="true" /></ToolbarOptionButton>
  </>;
}
