import { CANVAS_PREFERENCES_KEY, DEFAULT_CANVAS_PREFERENCES, readCanvasPreferences, saveCanvasPreferences } from '@ui/canvas_preferences/canvasPreferenceStorage';
import { LOCAL_PREFERENCES_RESET_EVENT } from '@ui/motion_preferences/MotionPreferenceProvider';

beforeEach(() => {
  localStorage.removeItem(CANVAS_PREFERENCES_KEY);
  window.dispatchEvent(new Event(LOCAL_PREFERENCES_RESET_EVENT));
});
afterEach(() => vi.restoreAllMocks());

it('persists independent defaults and ordered membership decisions without sharing mutable defaults', () => {
  const value = structuredClone(DEFAULT_CANVAS_PREFERENCES);
  value.defaults.zoneLocked = false;
  value.defaults.snapToGrid = true;
  value.membership = 'cells';
  value.deciders = ['ask', 'current', 'nearest', 'cells'];
  saveCanvasPreferences(value);
  expect(readCanvasPreferences()).toEqual(value);
  const read = readCanvasPreferences(); read.defaults.zoneLocked = true;
  expect(readCanvasPreferences().defaults.zoneLocked).toBe(false);
});

it('rejects invalid rule combinations and malformed decision orders', () => {
  localStorage.setItem(CANVAS_PREFERENCES_KEY, JSON.stringify({ defaults: { ...DEFAULT_CANVAS_PREFERENCES.defaults, allowOverlap: true }, deciders: ['ask', 'ask', 'cells', 'current'] }));
  expect(readCanvasPreferences()).toEqual(DEFAULT_CANVAS_PREFERENCES);
});

it('keeps preferences usable when storage fails, then clears them on reset', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  const value = { ...structuredClone(DEFAULT_CANVAS_PREFERENCES), tracerInvalidRoute: 'detour' as const };
  saveCanvasPreferences(value);
  expect(readCanvasPreferences()).toEqual(value);
  window.dispatchEvent(new Event(LOCAL_PREFERENCES_RESET_EVENT));
  expect(readCanvasPreferences()).toEqual(DEFAULT_CANVAS_PREFERENCES);
});

it('uses another tab’s preferences after a storage event', () => {
  const value = { ...structuredClone(DEFAULT_CANVAS_PREFERENCES), membership: 'overlap' as const };
  localStorage.setItem(CANVAS_PREFERENCES_KEY, JSON.stringify(value));
  window.dispatchEvent(new StorageEvent('storage', { key: CANVAS_PREFERENCES_KEY }));
  expect(readCanvasPreferences()).toEqual(value);
});


it('defaults legacy projection preferences off and synchronizes explicit choices', () => {
  localStorage.setItem(CANVAS_PREFERENCES_KEY, JSON.stringify({ membership: 'cells' }));
  expect(readCanvasPreferences().projectIsometricTokens).toBe(false);
  const next = { ...readCanvasPreferences(), projectIsometricTokens: true };
  saveCanvasPreferences(next);
  expect(readCanvasPreferences().projectIsometricTokens).toBe(true);
  localStorage.setItem(CANVAS_PREFERENCES_KEY, JSON.stringify({ ...next, projectIsometricTokens: false }));
  window.dispatchEvent(new StorageEvent('storage', { key: CANVAS_PREFERENCES_KEY }));
  expect(readCanvasPreferences().projectIsometricTokens).toBe(false);
});
