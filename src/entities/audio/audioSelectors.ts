import type { EncounterState } from "@core/encounter/types";
import type { AudioCue, AudioCueGroup } from "./types";

export function getAudioCuesForGroup(state: EncounterState, groupId: string): AudioCue[] {
  return state.audioCues.allIds.map((id) => state.audioCues.byId[id]).filter((cue) => cue?.placement.type === "group" && cue.placement.groupId === groupId);
}

export function getAudioGroupsBySection(state: EncounterState, section: AudioCueGroup["section"]): AudioCueGroup[] {
  const ids = section === "music" ? state.musicGroupIds : state.audioCueGroups.allIds.filter((id) => state.audioCueGroups.byId[id]?.section === section);
  return ids.map((id) => state.audioCueGroups.byId[id]).filter(Boolean);
}

export function getGroupInheritorIds(state: EncounterState, group: AudioCueGroup): string[] {
  if (group.section === "music" || group.section === "ambiance") return [];
  const collection = group.section === "zone" ? state.zones : state.actors;
  return collection.allIds.filter((id) => collection.byId[id]?.audioGroupIds?.includes(group.id));
}

export function getGroupInheritorNames(state: EncounterState, group: AudioCueGroup): string[] {
  const collection = group.section === "zone" ? state.zones : state.actors;
  return getGroupInheritorIds(state, group).map((id) => collection.byId[id].name);
}
