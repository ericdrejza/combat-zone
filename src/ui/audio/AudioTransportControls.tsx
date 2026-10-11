import { Info, Pause, Play, SkipBack, SkipForward, Square } from "lucide-react";

import type { AudioCueGroupSection } from "@entities/audio/types";

import { useAudioPlayback } from "./AudioPlaybackProvider";
import type { AudioPlaybackScope } from "./audioPlaybackTypes";

/** Shared transport keeps the panel and Soundboard on the same playback state. */
export function AudioTransportControls() {
  const playback = useAudioPlayback();
  const buttonClass = "flex h-8 w-8 items-center justify-center rounded-full border border-canvas-line disabled:opacity-40";
  return <div aria-label="Audio playback controls" className="flex items-center justify-center gap-2" role="group">
    <button aria-label="Previous music track" className={buttonClass} disabled={!playback.hasMusicPlayback} onClick={() => void playback.skipMusic(-1)} type="button"><SkipBack aria-hidden="true" className="h-4 w-4" /></button>
    <button aria-label="Stop all audio" className={buttonClass} disabled={!playback.hasPlayback} onClick={playback.stopAll} type="button"><Square aria-hidden="true" className="h-4 w-4 fill-current" /></button>
    <button aria-label={playback.hasPausedPlayback ? "Resume paused audio" : "Pause all audio"} className={buttonClass} disabled={!playback.hasPlayback} onClick={playback.hasPausedPlayback ? playback.resumeAll : playback.pauseAll} type="button">{playback.hasPausedPlayback ? <Play aria-hidden="true" className="h-4 w-4" /> : <Pause aria-hidden="true" className="h-4 w-4" />}</button>
    <button aria-label="Next music track" className={buttonClass} disabled={!playback.hasMusicPlayback} onClick={() => void playback.skipMusic(1)} type="button"><SkipForward aria-hidden="true" className="h-4 w-4" /></button>
  </div>;
}

export function MusicSectionControls({ infoFirst = false }: { infoFirst?: boolean }) {
  const information = <button aria-label="Music playback information" className="flex h-8 w-8 items-center justify-center text-canvas-muted" title="Only one track can play across the entire Music section. Starting another track stops the current track, including tracks in other groups." type="button"><Info aria-hidden="true" className="h-4 w-4" /></button>;
  return <>
    {infoFirst ? information : null}
    <SectionPlaybackButton label="music" scope="music" />
    {infoFirst ? null : information}
  </>;
}

export function SectionPlaybackButton({ label, scope }: { label: string; scope: AudioPlaybackScope }) {
  const playback = useAudioPlayback();
  const paused = playback.isSectionPaused(scope);
  return <button aria-label={`${paused ? "Resume" : "Pause"} ${label}`} title={`${paused ? "Resume" : "Pause"} ${label}`} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full enabled:hover:bg-canvas enabled:hover:ring-2 enabled:hover:ring-canvas-muted focus-visible:ring-2 focus-visible:ring-canvas-ink disabled:cursor-not-allowed disabled:opacity-40" disabled={!playback.hasSectionPlayback(scope)} onClick={() => paused ? playback.resumeSection(scope) : playback.pauseSection(scope)} type="button">{paused ? <Play aria-hidden="true" className="h-4 w-4" /> : <Pause aria-hidden="true" className="h-4 w-4" />}</button>;
}

/** Idle groups can start their cues; Music starts at the first playlist track. */
export function GroupPlaybackButton({ cueIds, groupId, label, section }: { cueIds: string[]; groupId: string; label: string; section: AudioCueGroupSection }) {
  const playback = useAudioPlayback();
  const scope = { groupId };
  const active = cueIds.some((id) => ["playing", "waiting", "paused"].includes(playback.getStatus(id)));
  const paused = playback.isSectionPaused(scope) || active && cueIds.filter((id) => ["playing", "waiting", "paused"].includes(playback.getStatus(id))).every((id) => playback.getStatus(id) === "paused");
  const action = active && !paused ? "Pause" : active ? "Resume" : "Play";
  function toggle() {
    if (active) {
      if (paused) playback.resumeSection(scope);
      else playback.pauseSection(scope);
      return;
    }
    playback.resumeSection(scope);
    for (const cueId of section === "music" ? cueIds.slice(0, 1) : cueIds) playback.playRegistered(cueId);
    playback.resumeSection(scope);
  }
  return <button aria-label={`${action} ${label}`} title={`${action} ${label}`} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full enabled:hover:bg-canvas enabled:hover:ring-2 enabled:hover:ring-canvas-muted focus-visible:ring-2 focus-visible:ring-canvas-ink disabled:cursor-not-allowed disabled:opacity-40" disabled={!cueIds.length} onClick={toggle} type="button">{action === "Pause" ? <Pause aria-hidden="true" className="h-4 w-4" /> : <Play aria-hidden="true" className="h-4 w-4" />}</button>;
}
