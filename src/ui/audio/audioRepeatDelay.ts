/** Shared delay choices keep cue controls and new-cue defaults consistent. */
export const AUDIO_REPEAT_DELAYS = [0, 1, 2, 5, 10, 15, 20, 30, 45, 60, 120, 300, 600, 900, 1200, 1800];

export function formatAudioRepeatDelay(seconds: number) {
  return seconds >= 60 ? `${seconds / 60}m` : `${seconds}s`;
}
