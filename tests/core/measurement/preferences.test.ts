import { clearMovementPreferenceFallback, MOVEMENT_PREFERENCES_KEY, readMovementPreferences, saveMovementPreferences } from '@ui/combat_preferences/movementPreferenceStorage';
import { DEFAULT_MOVEMENT_PREFERENCES } from '@core/measurement/types';

afterEach(() => { vi.restoreAllMocks(); clearMovementPreferenceFallback(); localStorage.removeItem(MOVEMENT_PREFERENCES_KEY); });
it('retains consistent UI and runtime preferences for the session when storage fails', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota'); });
  const next = { ...DEFAULT_MOVEMENT_PREFERENCES, trackMovement: true, diagonalCost: 'disabled' as const };
  saveMovementPreferences(next);
  expect(readMovementPreferences()).toEqual(next);
  clearMovementPreferenceFallback(); expect(readMovementPreferences()).toEqual(DEFAULT_MOVEMENT_PREFERENCES);
});
it('normalizes malformed preference fields instead of accepting unsupported costs or reset modes', () => {
  localStorage.setItem(MOVEMENT_PREFERENCES_KEY, JSON.stringify({ diagonalCost: 'three', trackMovement: 'yes', resetMovement: 'encounter' }));
  expect(readMovementPreferences()).toEqual(DEFAULT_MOVEMENT_PREFERENCES);
});
