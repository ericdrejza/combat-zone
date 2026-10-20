import { act, renderHook } from '@testing-library/react';
import { useCanvasPreferences } from '@ui/canvas_preferences/useCanvasPreferences';
import { CANVAS_PREFERENCES_KEY, DEFAULT_CANVAS_PREFERENCES, readCanvasPreferences, saveCanvasPreferences } from '@ui/canvas_preferences/canvasPreferenceStorage';
import { LOCAL_PREFERENCES_RESET_EVENT } from '@ui/motion_preferences/MotionPreferenceProvider';

afterEach(() => {
  localStorage.removeItem(CANVAS_PREFERENCES_KEY);
  window.dispatchEvent(new Event(LOCAL_PREFERENCES_RESET_EVENT));
});
it('synchronizes ruler preferences locally, across tabs and after reset', () => {
  const { result } = renderHook(useCanvasPreferences);
  const changed = { ...DEFAULT_CANVAS_PREFERENCES, rulerCellCoverage: 'majority' as const, rulerFeel: 'flexible' as const, rulerColor: '#abcdef', rulerOpacity: 0.4, showActorMovementDistance: false };
  act(() => saveCanvasPreferences(changed));
  expect(result.current.preferences).toEqual(changed);
  localStorage.setItem(CANVAS_PREFERENCES_KEY, JSON.stringify({ ...changed, rulerColor: '#123456' }));
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: CANVAS_PREFERENCES_KEY })));
  expect(result.current.preferences.rulerColor).toBe('#123456');
  localStorage.removeItem(CANVAS_PREFERENCES_KEY);
  act(() => window.dispatchEvent(new Event(LOCAL_PREFERENCES_RESET_EVENT)));
  expect(result.current.preferences).toEqual(DEFAULT_CANVAS_PREFERENCES);
});
it('defaults invalid stored ruler colors and opacity', () => {
  localStorage.setItem(CANVAS_PREFERENCES_KEY, JSON.stringify({ rulerCellCoverage: 'invalid', rulerFeel: 'unknown', rulerColor: 'red', rulerOpacity: 2 }));
  expect(readCanvasPreferences()).toMatchObject({ rulerCellCoverage: 'corners-or-center', rulerFeel: 'rigid', rulerColor: null, rulerOpacity: 1, showActorMovementDistance: true });
});
