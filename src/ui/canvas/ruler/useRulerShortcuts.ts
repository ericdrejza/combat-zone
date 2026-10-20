import { useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import type { RulerOptions } from '@core/measurement/types';
import { clearRulers, setRulerOptions } from '@interaction/interactionState';
import { ignoreShortcut } from '@ui/keybinds/keyboardGuards';
import { useCanvasPreferences } from '@ui/canvas_preferences/useCanvasPreferences';

export function useRulerShortcuts(active: boolean, options: RulerOptions, square: boolean) {
  const dispatch = useDispatch(), { preferences, save } = useCanvasPreferences();
  const current = useRef({ active, options, square, preferences, save }); current.current = { active, options, square, preferences, save };
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      const { active, preferences, save } = current.current;
      if (!active || ignoreShortcut(event) || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || event.repeat) return;
      const shapes = ['path', 'circle', 'cone', 'rectangle', 'line'] as const, index = Number(event.key) - 1;
      if (/^[1-5]$/.test(event.key)) dispatch(setRulerOptions({ shape: shapes[index] }));
      else if (event.key === '0') dispatch(clearRulers());
      else if (event.key === '9') save({ ...preferences, showActorMovementDistance: !preferences.showActorMovementDistance });
      else return;
      event.preventDefault(); event.stopImmediatePropagation();
    };
    const wheel = (event: WheelEvent) => {
      const { active, options, square } = current.current;
      if (!active || options.shape !== 'cone' || !event.shiftKey || ignoreShortcut(event) || !event.deltaY || !(event.target instanceof Element) || !event.target.closest('[aria-label="SVG encounter workspace"]')) return;
      event.preventDefault(); event.stopImmediatePropagation();
      dispatch(setRulerOptions({ angle: Math.max(1, Math.min(180, (options.angle ?? (square ? 90 : 60)) - Math.sign(event.deltaY))) }));
    };
    window.addEventListener('keydown', key, true); window.addEventListener('wheel', wheel, { capture: true, passive: false });
    return () => { window.removeEventListener('keydown', key, true); window.removeEventListener('wheel', wheel, true); };
  }, [dispatch]);
}
