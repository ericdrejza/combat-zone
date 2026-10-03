import type { AudioCueGroupSection, AudioCueType, AudioSectionType } from "@entities/audio/types";

export function getAudioDestinationSections(scope: AudioSectionType, type: AudioCueType): AudioCueGroupSection[] {
  return scope === "encounter" ? type === "loop" ? ["ambiance", "music"] : ["ambiance"] : [scope];
}
