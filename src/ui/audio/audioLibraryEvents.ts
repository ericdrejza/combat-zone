import type { AudioCuePlacement } from "@entities/audio/types";

export const OPEN_AUDIO_LIBRARY_EVENT = "combat-zone:open-audio-library";
export const RELINK_AUDIO_LIBRARY_EVENT = "combat-zone:relink-audio-library";

export function openAudioLibraryForRelink(cueId: string): void {
  window.dispatchEvent(new CustomEvent<string>(RELINK_AUDIO_LIBRARY_EVENT, { detail: cueId }));
  window.focus();
}

/** Bridges the external Soundboard portal to the application-owned Library modal. */
export function openAudioLibraryForCue(placement: AudioCuePlacement): void {
  window.dispatchEvent(new CustomEvent<AudioCuePlacement>(OPEN_AUDIO_LIBRARY_EVENT, { detail: placement }));
  window.focus();
}
