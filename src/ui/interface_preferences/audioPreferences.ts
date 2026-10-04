import { DEFAULT_AUDIO_REPEAT_DELAY_SETTINGS, type AudioRepeatDelaySettings } from "@entities/audio/types";
import { AUDIO_REPEAT_DELAYS } from "@ui/audio/audioRepeatDelay";

function allowedDelay(value: unknown, fallback: number): number {
  return typeof value === "number" && AUDIO_REPEAT_DELAYS.includes(value) ? value : fallback;
}

export function readAudioCueVolumeDefault(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1 ? value : 0.5;
}

export function readAudioRepeatDelayDefaults(value: unknown): AudioRepeatDelaySettings {
  const stored = value && typeof value === "object" ? value as Partial<AudioRepeatDelaySettings> : {};
  const minimum = allowedDelay(stored.minimumDelaySeconds, DEFAULT_AUDIO_REPEAT_DELAY_SETTINGS.minimumDelaySeconds);
  return {
    minimumDelaySeconds: minimum,
    maximumDelaySeconds: Math.max(minimum, allowedDelay(stored.maximumDelaySeconds, DEFAULT_AUDIO_REPEAT_DELAY_SETTINGS.maximumDelaySeconds))
  };
}
