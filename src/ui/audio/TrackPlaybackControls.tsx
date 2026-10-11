import { Pause, Play, Square } from "lucide-react";

import type { AudioCue } from "@entities/audio/types";
import { useAudioPlayback } from "./AudioPlaybackProvider";

/** Pause retains the seek position; Stop discards playback and resets the cue. */
export function TrackPlaybackControls({ cue, name, sourceUrl }: { cue: AudioCue; name: string; sourceUrl: string | null }) {
  const playback = useAudioPlayback();
  const status = playback.getStatus(cue.id);
  const active = status !== "idle" && status !== "error";
  const running = status === "playing" || status === "waiting";
  const action = running ? "Pause" : "Play";
  const buttonClass = "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-canvas-line enabled:hover:bg-canvas enabled:hover:ring-2 enabled:hover:ring-canvas-muted focus-visible:ring-2 focus-visible:ring-canvas-ink disabled:cursor-not-allowed disabled:opacity-40";
  function toggle() {
    if (running) playback.pauseTrack(cue.id);
    else if (active) playback.resumeTrack(cue.id);
    else if (sourceUrl) void playback.play(cue, sourceUrl);
  }
  return <div className="flex shrink-0 items-center gap-1">
    <button aria-label={`Stop ${name}`} title={`Stop ${name}`} className={buttonClass} disabled={!active} onClick={() => playback.stop(cue.id)} type="button"><Square aria-hidden="true" className="h-3 w-3 fill-current" /></button>
    <button aria-label={`${action} ${name}`} title={`${action} ${name}`} className={buttonClass} disabled={!active && !sourceUrl} onClick={toggle} type="button">{running ? <Pause aria-hidden="true" className="h-3.5 w-3.5" /> : <Play aria-hidden="true" className="h-3.5 w-3.5" />}</button>
  </div>;
}
