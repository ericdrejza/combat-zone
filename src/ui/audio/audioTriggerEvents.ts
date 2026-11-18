export const AUDIO_TRIGGER_EVENT = "combat-zone:audio-trigger";

export type AudioTriggerRequest = {
  /** Explicit Rollable launches do not depend on movement/health trigger switches. */
  explicit?: boolean;
  cueId: string;
  instanceId: string;
};

export function emitAudioTriggers(requests: AudioTriggerRequest[]): void {
  if (!requests.length || typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(AUDIO_TRIGGER_EVENT, { detail: requests }));
}
