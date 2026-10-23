import { useCallback, useEffect, useRef } from 'react';
import { cancelFrame, frame } from 'motion/react';

/** Coalesce pointer bursts without losing the final position on release or locking. */
export function useRulerDragFrame() {
  const pending = useRef<(() => void) | null>(null);
  const flush = useCallback(() => {
    cancelFrame(flush);
    const update = pending.current;
    pending.current = null;
    update?.();
  }, []);
  const cancel = useCallback(() => { cancelFrame(flush); pending.current = null; }, [flush]);
  const schedule = useCallback((update: () => void) => {
    const queued = pending.current !== null;
    pending.current = update;
    if (!queued) frame.update(flush);
  }, [flush]);
  useEffect(() => cancel, [cancel]);
  return { schedule, flush, cancel };
}
