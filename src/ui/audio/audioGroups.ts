import type { EncounterState } from "@core/encounter/types";
import { getAudioCuesForGroup, getAudioGroupsBySection, getGroupInheritorNames } from "@entities/audio/audioSelectors";
import type { AudioCue, AudioCueGroupSection } from "@entities/audio/types";

export type AudioDisplayGroup = {
  cues: AudioCue[];
  id: string;
  inheritors: string[];
  label: string;
  section: "ambiance" | AudioCueGroupSection;
};

export type AudioDisplaySection = {
  groups: AudioDisplayGroup[];
  id: "encounter" | "zone" | "actor";
  label: string;
};

export function getAudioSections(encounter: EncounterState): AudioDisplaySection[] {
  const group = (section: AudioCueGroupSection): AudioDisplayGroup[] =>
    getAudioGroupsBySection(encounter, section).map((item) => ({
      cues: getAudioCuesForGroup(encounter, item.id),
      id: item.id,
      inheritors: getGroupInheritorNames(encounter, item),
      label: item.name,
      section
    }));
  return [
    {
      groups: [
        ...group("ambiance"),
        ...group("music")
      ],
      id: "encounter",
      label: "Encounter"
    },
    { groups: group("zone"), id: "zone", label: "Zones" },
    { groups: group("actor"), id: "actor", label: "Actors" }
  ];
}
