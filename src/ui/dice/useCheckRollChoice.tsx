import { useCallback, useEffect, useRef, useState } from "react";
import type { CheckRollMode } from "@core/dice/types";
import { StatusDialog } from "@ui/panels/status_panel/StatusDialog";
import { DICE_BUTTON } from "./DiceIconButton";

/** The launching component owns the prompt so hidden Log panels are not required. */
export function useCheckRollChoice() {
  const [open, setOpen] = useState(false);
  const complete = useRef<((mode: CheckRollMode | null) => void) | null>(null);
  const finish = useCallback((mode: CheckRollMode | null) => {
    const pending = complete.current; complete.current = null;
    setOpen(false); pending?.(mode);
  }, []);
  useEffect(() => () => { complete.current?.(null); complete.current = null; }, []);
  const choose = useCallback((signal: AbortSignal) => new Promise<CheckRollMode | null>(resolve => {
    if (signal.aborted) { resolve(null); return; }
    const abort = () => finish(null);
    complete.current = mode => { signal.removeEventListener("abort", abort); resolve(mode); };
    signal.addEventListener("abort", abort, { once: true });
    setOpen(true);
  }), [finish]);
  const dialog = open ? <StatusDialog title="Check roll" onClose={() => finish(null)} cancelOnBackdrop>
    <div className="flex flex-col gap-2">
      <button type="button" className={DICE_BUTTON} onClick={() => finish("shared")}>One check for all targets</button>
      <button type="button" className={DICE_BUTTON} onClick={() => finish("perTarget")}>One check per target</button>
    </div>
    <div className="mt-3 flex justify-end"><button type="button" className={DICE_BUTTON} onClick={() => finish(null)}>Cancel</button></div>
  </StatusDialog> : null;
  return { choose, dialog };
}
