import type { AudioCueGroupSection } from "./types";

/** Shared by creation and naming placeholders so an empty name has one default. */
export function getDefaultAudioCueGroupName(section: AudioCueGroupSection): string {
  const names: Record<AudioCueGroupSection, string> = {
    actor: "New Actor Group", ambiance: "New Ambience Group",
    music: "New Music Group", zone: "New Zone Group"
  };
  return names[section];
}
