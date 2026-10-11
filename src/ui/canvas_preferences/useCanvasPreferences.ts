import { useEffect, useState } from 'react';
import { LOCAL_PREFERENCES_RESET_EVENT } from '@ui/motion_preferences/MotionPreferenceProvider';
import { CANVAS_PREFERENCES_EVENT, CANVAS_PREFERENCES_KEY, readCanvasPreferences, saveCanvasPreferences, type CanvasPreferences } from './canvasPreferenceStorage';
export function useCanvasPreferences() {
  const [preferences, setPreferences] = useState(readCanvasPreferences);
  useEffect(() => {
    const reset = () => setPreferences(readCanvasPreferences());
    const local = (event: Event) => setPreferences((event as CustomEvent<CanvasPreferences>).detail);
    const storage = (event: StorageEvent) => { if (!event.key || event.key === CANVAS_PREFERENCES_KEY) reset(); };
    globalThis.addEventListener(LOCAL_PREFERENCES_RESET_EVENT, reset);
    globalThis.addEventListener(CANVAS_PREFERENCES_EVENT, local);
    globalThis.addEventListener('storage', storage);
    return () => { globalThis.removeEventListener(LOCAL_PREFERENCES_RESET_EVENT, reset); globalThis.removeEventListener(CANVAS_PREFERENCES_EVENT, local); globalThis.removeEventListener('storage', storage); };
  }, []);
  function save(value: CanvasPreferences) { setPreferences(value); saveCanvasPreferences(value); }
  return { preferences, save };
}
