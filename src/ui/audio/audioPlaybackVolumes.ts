import type { PlaybackEntry } from "./audioPlaybackTypes";

/** Shared trigger audio uses the highest participating cue volume, applied once. */
export function updatePlaybackVolumes(entries: Iterable<PlaybackEntry>, masterVolume: number): void {
  const volumes = new Map<HTMLAudioElement, number>();
  for (const entry of entries) volumes.set(entry.audio, Math.max(volumes.get(entry.audio) ?? 0, entry.cue.volume));
  for (const [audio, volume] of volumes) audio.volume = Math.max(0, Math.min(1, volume * masterVolume));
}
