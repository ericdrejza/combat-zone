import { useEffect, useRef, type MouseEvent } from "react";

const DOUBLE_CLICK_DELAY_MS = 250;

/** Selection can expand neighboring panels and move the reference before a second click lands. */
export function useLogReferenceGestures(select: () => void, navigate: () => void, resetKey?: number) {
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ select, navigate, resetKey });
  latest.current = { select, navigate, resetKey };
  function cancel() { if (pending.current) clearTimeout(pending.current); pending.current = null; }
  useEffect(() => cancel, [resetKey]);
  return {
    onClick(event: MouseEvent<HTMLButtonElement>) {
      cancel();
      // Native keyboard/assistive activation has no pointer double-click to arbitrate.
      if (event.detail === 0) { latest.current.select(); return; }
      if (event.detail > 1) return;
      pending.current = setTimeout(() => {
        pending.current = null;
        if (latest.current.resetKey === resetKey) latest.current.select();
      }, DOUBLE_CLICK_DELAY_MS);
    },
    onDoubleClick() { cancel(); latest.current.navigate(); }
  };
}
