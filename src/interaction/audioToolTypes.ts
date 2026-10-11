import type { AudioCueType } from "@entities/audio/types";

/** Asset classification is a tool choice; persisted cues remain Track or Effect. */
export type AudioCueTypeChoice = AudioCueType | "asset" | "duration";
