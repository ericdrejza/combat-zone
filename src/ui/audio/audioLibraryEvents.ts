import type { AudioCuePlacement } from "@entities/audio/types";

export const OPEN_AUDIO_LIBRARY_EVENT = "combat-zone:open-audio-library";

/** Bridges the external Soundboard portal to the application-owned Library modal. */
export function openAudioLibraryForCue(placement: AudioCuePlacement): void {
  window.dispatchEvent(new CustomEvent<AudioCuePlacement>(OPEN_AUDIO_LIBRARY_EVENT, { detail: placement }));
  window.focus();
}
