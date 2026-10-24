export type FocusPreferences = {
  activation: 'hold' | 'toggle';
  color: string;
  tailLength: number;
  glowIntensity: number;
};

// Keep stored lengths in their original units so an existing 15% preference now displays as 50%.
export const MAX_FOCUS_TAIL_LENGTH = 0.3;

export const DEFAULT_FOCUS_PREFERENCES: FocusPreferences = {
  activation: 'hold', color: '#ff0000', tailLength: MAX_FOCUS_TAIL_LENGTH / 2, glowIntensity: 0.65
};

/** Invalid individual fields fall back without discarding other saved Canvas preferences. */
export function readFocusPreferences(value: unknown): FocusPreferences {
  const stored = value && typeof value === 'object' ? value as Partial<FocusPreferences> : {};
  const percentage = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1 ? value : fallback;
  return {
    activation: stored.activation === 'toggle' ? 'toggle' : 'hold',
    color: typeof stored.color === 'string' && /^#[0-9a-f]{6}$/i.test(stored.color) ? stored.color : DEFAULT_FOCUS_PREFERENCES.color,
    tailLength: Math.min(MAX_FOCUS_TAIL_LENGTH, percentage(stored.tailLength, DEFAULT_FOCUS_PREFERENCES.tailLength)),
    glowIntensity: percentage(stored.glowIntensity, DEFAULT_FOCUS_PREFERENCES.glowIntensity)
  };
}
