import type { AudioCueGroupSection, AudioCueType, AudioSectionType } from "@entities/audio/types";

export function getAudioDestinationSections(scope: AudioSectionType, type: AudioCueType): AudioCueGroupSection[] {
  return scope === "encounter" ? type === "track" ? ["ambiance", "music"] : ["ambiance"] : [scope];
}
