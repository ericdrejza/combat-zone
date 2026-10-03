import type { EntityId } from "@core/state/entityCollection";

export type AudioCueType = "loop" | "one_shot";
export type AudioCueTrigger = "zone_enter" | "zone_leave" | "actor_enter_zone" | "actor_leave_zone";
export type AudioSectionType = "encounter" | "zone" | "actor";
export type AudioCueGroupSection = "ambiance" | "music" | "zone" | "actor";

export type AudioCuePlacement = { type: "group"; groupId: EntityId };

export type AudioRepeatDelaySettings = {
  minimumDelaySeconds: number;
  maximumDelaySeconds: number;
};

/** Persisted audio configuration; actual playback remains session-only. */
export type AudioCue = {
  id: EntityId;
  libraryNodeId: string;
  placement: AudioCuePlacement;
  type: AudioCueType;
  volume: number;
  repeatDelay: AudioRepeatDelaySettings;
  triggers: AudioCueTrigger[];
  /** Retains trigger selections independently of the active behavior. */
  triggersEnabled: boolean;
  repeat: boolean;
};

export type AudioCueGroup = {
  id: EntityId;
  name: string;
  /** Music groups can wrap from their last cue back to their first cue. */
  repeat: boolean;
  section: AudioCueGroupSection;
};

export const DEFAULT_AUDIO_REPEAT_DELAY_SETTINGS: AudioRepeatDelaySettings = {
  minimumDelaySeconds: 0,
  maximumDelaySeconds: 0
};
