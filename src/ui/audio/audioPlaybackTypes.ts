import type { AudioCue, AudioCueGroupSection } from "@entities/audio/types";

export type AudioPlaybackScope = AudioCueGroupSection | "encounter";

export type AudioPlaybackStatus = "idle" | "playing" | "waiting" | "paused" | "error";
export type MusicGroupPlayback = { cueIds: string[]; repeat: boolean };
export type RegisteredAudioCue = { cue: AudioCue; sourceUrl: string; assetId: string };
export type PlaybackEntry = {
  audio: HTMLAudioElement;
  cue: AudioCue;
  dueAt: number | null;
  remainingDelay: number | null;
  status: Exclude<AudioPlaybackStatus, "idle" | "error">;
  timer: ReturnType<typeof setTimeout> | null;
};
