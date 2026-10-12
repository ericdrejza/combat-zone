import { useEffect } from 'react';
import { beginEncounterOperation } from '@core/history/encounterOperations';

/** Native transfers can originate outside CanvasShell or even outside the browser. */
export function useEncounterTransfers(): void {
  useEffect(() => {
    let release: (() => void) | undefined;
    const start = () => { release ??= beginEncounterOperation(); };
    const end = () => { release?.(); release = undefined; };
    const enter = (event: DragEvent) => {
      if (event.dataTransfer?.types?.includes('Files') && event.target instanceof Element &&
          event.target.closest('[aria-label="Encounter canvas"]')) start();
    };
    const leave = (event: DragEvent) => {
      if (!event.relatedTarget && (event.target === document.documentElement || event.target === document.body)) end();
    };
    // Drop handlers may stop bubbling; capture still releases the transfer token.
    window.addEventListener('dragstart', start, true);
    window.addEventListener('dragenter', enter, true);
    window.addEventListener('dragleave', leave, true);
    window.addEventListener('dragend', end, true);
    window.addEventListener('drop', end, true);
    window.addEventListener('blur', end);
    return () => {
      end();
      window.removeEventListener('dragstart', start, true);
      window.removeEventListener('dragenter', enter, true);
      window.removeEventListener('dragleave', leave, true);
      window.removeEventListener('dragend', end, true);
      window.removeEventListener('drop', end, true);
      window.removeEventListener('blur', end);
    };
  }, []);
}
