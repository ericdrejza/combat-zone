import type { EncounterState } from "@core/encounter/types";
import type { EntityCollection, EntityId } from "@core/state/entityCollection";
import { DEFAULT_AUDIO_REPEAT_DELAY_SETTINGS, type AudioCue, type AudioCueGroup, type AudioCueGroupSection, type AudioCueTrigger } from "./types";
import { getDefaultAudioCueGroupName } from "./audioGroupNames";

export type CreateAudioCueInput = Pick<AudioCue, "id" | "libraryNodeId" | "placement" | "type"> & Partial<Pick<AudioCue, "repeat" | "repeatDelay" | "triggers" | "triggersEnabled" | "volume">>;

function upsert<TEntity extends { id: EntityId }>(collection: EntityCollection<TEntity>, entity: TEntity): EntityCollection<TEntity> {
  return { byId: { ...collection.byId, [entity.id]: entity }, allIds: collection.allIds.includes(entity.id) ? collection.allIds : [...collection.allIds, entity.id] };
}

const SECTION_TRIGGERS: Partial<Record<AudioCueGroupSection, AudioCueTrigger[]>> = {
  actor: ["actor_enter_zone", "actor_leave_zone"],
  zone: ["zone_enter", "zone_leave"]
};

function cueAllowed(state: EncounterState, cue: Pick<AudioCue, "placement" | "triggers" | "triggersEnabled" | "repeat" | "type">) {
  const section = state.audioCueGroups.byId[cue.placement.groupId]?.section;
  return Boolean(section) &&
    (!cue.triggersEnabled || !cue.repeat && (section === "actor" || section === "zone")) &&
    (section !== "music" || cue.type === "loop") &&
    ((section !== "actor" && section !== "zone") || cue.type === "one_shot") &&
    cue.triggers.every((trigger) => cue.type === "one_shot" && SECTION_TRIGGERS[section!]?.includes(trigger));
}

function normalizeCueForSection(cue: AudioCue, section: AudioCueGroupSection): AudioCue {
  const type = section === "music" ? "loop" : section === "zone" || section === "actor" ? "one_shot" : cue.type;
  const allowedTriggers = SECTION_TRIGGERS[section] ?? [];
  return { ...cue, triggers: cue.triggers.filter((trigger) => allowedTriggers.includes(trigger)), triggersEnabled: allowedTriggers.length > 0 && cue.triggersEnabled, type };
}

export function createAudioCue(state: EncounterState, input: CreateAudioCueInput): EncounterState {
  if (state.audioCues.byId[input.id]) return state;
  const cue: AudioCue = {
    id: input.id,
    repeatDelay: input.repeatDelay ?? { ...DEFAULT_AUDIO_REPEAT_DELAY_SETTINGS },
    libraryNodeId: input.libraryNodeId,
    placement: input.placement,
    repeat: input.repeat ?? input.type === "loop",
    triggers: input.triggers ?? [],
    triggersEnabled: input.triggersEnabled ?? (!(input.repeat ?? input.type === "loop") && Boolean(input.triggers?.length)),
    type: input.type,
    volume: Math.max(0, Math.min(1, input.volume ?? 0.5))
  };
  if (!cueAllowed(state, cue)) return state;
  return { ...state, audioCues: upsert(state.audioCues, cue) };
}

export function updateAudioCue(state: EncounterState, cueId: string, update: Partial<Omit<AudioCue, "id" | "placement">>): EncounterState {
  const cue = state.audioCues.byId[cueId];
  if (!cue) return state;
  if (update.repeat === true && update.triggersEnabled === true) return state;
  const nextType = update.type ?? cue.type;
  const triggersEnabled = nextType === "one_shot" && (update.repeat === true ? false : update.triggersEnabled ?? cue.triggersEnabled);
  const nextCue = {
    ...cue,
    ...update,
    triggers: nextType === "one_shot" ? update.triggers ?? cue.triggers : [],
    repeat: update.triggersEnabled === true ? false : update.repeat ?? cue.repeat,
    triggersEnabled,
    volume: update.volume === undefined ? cue.volume : Math.max(0, Math.min(1, update.volume))
  };
  if (!cueAllowed(state, nextCue)) return state;
  return { ...state, audioCues: upsert(state.audioCues, nextCue) };
}

export function deleteAudioCue(state: EncounterState, cueId: string): EncounterState {
  if (!state.audioCues.byId[cueId]) return state;
  const byId = { ...state.audioCues.byId };
  delete byId[cueId];
  return { ...state, audioCues: { byId, allIds: state.audioCues.allIds.filter((id) => id !== cueId) } };
}

export function createAudioCueGroup(state: EncounterState, input: { id: string; name?: string; section: AudioCueGroupSection }): EncounterState {
  if (state.audioCueGroups.byId[input.id]) return state;
  const group: AudioCueGroup = { id: input.id, name: input.name?.trim() || getDefaultAudioCueGroupName(input.section), repeat: false, section: input.section };
  return {
    ...state,
    audioCueGroups: upsert(state.audioCueGroups, group),
    musicGroupIds: input.section === "music" ? [...state.musicGroupIds, input.id] : state.musicGroupIds
  };
}

export function renameAudioCueGroup(state: EncounterState, groupId: string, name: string): EncounterState {
  const group = state.audioCueGroups.byId[groupId];
  const trimmed = name.trim();
  if (!group || !trimmed || group.name === trimmed) return state;
  return { ...state, audioCueGroups: upsert(state.audioCueGroups, { ...group, name: trimmed }) };
}

export function setAudioCueGroupRepeat(state: EncounterState, groupId: string, repeat: boolean): EncounterState {
  const group = state.audioCueGroups.byId[groupId];
  if (!group || group.section !== "music" || group.repeat === repeat) return state;
  return { ...state, audioCueGroups: upsert(state.audioCueGroups, { ...group, repeat }) };
}

export function deleteAudioCueGroup(state: EncounterState, groupId: string): EncounterState {
  if (!state.audioCueGroups.byId[groupId]) return state;
  const groupById = { ...state.audioCueGroups.byId };
  delete groupById[groupId];
  const cueIds = state.audioCues.allIds.filter((id) => {
    const placement = state.audioCues.byId[id].placement;
    return placement.type !== "group" || placement.groupId !== groupId;
  });
  return {
    ...state,
    audioCueGroups: { byId: groupById, allIds: state.audioCueGroups.allIds.filter((id) => id !== groupId) },
    audioCues: { byId: Object.fromEntries(cueIds.map((id) => [id, state.audioCues.byId[id]])), allIds: cueIds },
    musicGroupIds: state.musicGroupIds.filter((id) => id !== groupId),
    zones: { ...state.zones, byId: Object.fromEntries(Object.entries(state.zones.byId).map(([id, zone]) => [id, { ...zone, audioGroupIds: (zone.audioGroupIds ?? []).filter((value) => value !== groupId) }])) },
    actors: { ...state.actors, byId: Object.fromEntries(Object.entries(state.actors.byId).map(([id, actor]) => [id, { ...actor, audioGroupIds: (actor.audioGroupIds ?? []).filter((value) => value !== groupId) }])) }
  };
}

export function setEntityAudioGroups(state: EncounterState, entityType: "zone" | "actor", entityId: string, groupIds: string[]): EncounterState {
  const entity = entityType === "zone" ? state.zones.byId[entityId] : state.actors.byId[entityId];
  if (!entity || groupIds.some((id) => state.audioCueGroups.byId[id]?.section !== entityType)) return state;
  const uniqueIds = [...new Set(groupIds)];
  if (entityType === "zone") return { ...state, zones: upsert(state.zones, { ...state.zones.byId[entityId], audioGroupIds: uniqueIds }) };
  return { ...state, actors: upsert(state.actors, { ...state.actors.byId[entityId], audioGroupIds: uniqueIds }) };
}

export function setMusicGroupOrder(state: EncounterState, groupIds: string[]): EncounterState {
  const uniqueIds = [...new Set(groupIds)];
  if (uniqueIds.length !== state.musicGroupIds.length || uniqueIds.some((id) => !state.musicGroupIds.includes(id))) return state;
  return { ...state, musicGroupIds: uniqueIds };
}

/** Reorders a cue and optionally moves it to another compatible group. */
export function moveAudioCue(state: EncounterState, cueId: string, placement: AudioCue["placement"], beforeCueId?: string): EncounterState {
  const cue = state.audioCues.byId[cueId];
  if (!cue) return state;
  const section = state.audioCueGroups.byId[placement.groupId]?.section;
  if (!section) return state;
  const moved = normalizeCueForSection({ ...cue, placement }, section);
  const allIds = state.audioCues.allIds.filter((id) => id !== cueId);
  const beforeIndex = beforeCueId ? allIds.indexOf(beforeCueId) : -1;
  allIds.splice(beforeIndex >= 0 ? beforeIndex : allIds.length, 0, cueId);
  return { ...state, audioCues: { byId: { ...state.audioCues.byId, [cueId]: moved }, allIds } };
}

/** Moves a group between sections and normalizes its cues for the destination. */
export function moveAudioCueGroup(state: EncounterState, groupId: string, section: AudioCueGroupSection, beforeGroupId?: string): EncounterState {
  const group = state.audioCueGroups.byId[groupId];
  if (!group) return state;
  const allIds = state.audioCueGroups.allIds.filter((id) => id !== groupId);
  const beforeIndex = beforeGroupId ? allIds.indexOf(beforeGroupId) : -1;
  allIds.splice(beforeIndex >= 0 ? beforeIndex : allIds.length, 0, groupId);
  const changedSection = group.section !== section;
  const nextGroup = { ...group, repeat: section === "music" ? group.repeat : false, section };
  const cueById = Object.fromEntries(Object.entries(state.audioCues.byId).map(([id, cue]) => [id, cue.placement.groupId === groupId ? normalizeCueForSection(cue, section) : cue]));
  const musicGroupIds = state.musicGroupIds.filter((id) => id !== groupId);
  if (section === "music") {
    const musicIndex = beforeGroupId ? musicGroupIds.indexOf(beforeGroupId) : -1;
    musicGroupIds.splice(musicIndex >= 0 ? musicIndex : musicGroupIds.length, 0, groupId);
  }
  return {
    ...state,
    actors: changedSection ? { ...state.actors, byId: Object.fromEntries(Object.entries(state.actors.byId).map(([id, actor]) => [id, { ...actor, audioGroupIds: (actor.audioGroupIds ?? []).filter((value) => value !== groupId) }])) } : state.actors,
    audioCueGroups: { byId: { ...state.audioCueGroups.byId, [groupId]: nextGroup }, allIds },
    audioCues: { ...state.audioCues, byId: cueById },
    musicGroupIds,
    zones: changedSection ? { ...state.zones, byId: Object.fromEntries(Object.entries(state.zones.byId).map(([id, zone]) => [id, { ...zone, audioGroupIds: (zone.audioGroupIds ?? []).filter((value) => value !== groupId) }])) } : state.zones
  };
}
