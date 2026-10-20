import { DEFAULT_MOVEMENT_PREFERENCES, type MovementPreferences } from '@core/measurement/types';

let sessionFallback: MovementPreferences | null = null;
export function clearMovementPreferenceFallback() { sessionFallback = null; }

export const MOVEMENT_PREFERENCES_KEY = 'combat-zone.movement-preferences';
export function readMovementPreferences(): MovementPreferences {
  if (sessionFallback) return { ...sessionFallback };
  try {
    const value = JSON.parse(localStorage.getItem(MOVEMENT_PREFERENCES_KEY) ?? 'null');
    return { diagonalCost: ['one', 'alternating', 'two', 'disabled'].includes(value?.diagonalCost) ? value.diagonalCost : 'one',
      trackMovement: value?.trackMovement === true, resetMovement: value?.resetMovement === 'round' ? 'round' : 'turn' };
  } catch { return { ...DEFAULT_MOVEMENT_PREFERENCES }; }
}
export const MOVEMENT_PREFERENCES_EVENT = 'combat-zone:movement-preferences';
export function saveMovementPreferences(value: MovementPreferences) {
  try { localStorage.setItem(MOVEMENT_PREFERENCES_KEY, JSON.stringify(value)); sessionFallback = null; }
  catch { sessionFallback = { ...value }; }
  globalThis.dispatchEvent(new CustomEvent(MOVEMENT_PREFERENCES_EVENT, { detail: value }));
}
