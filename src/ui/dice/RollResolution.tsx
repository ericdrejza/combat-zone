import { newlyPendingRolls } from "./resolutionRequests";
import { Dices, Pencil, RotateCcw, Undo2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useStore } from "react-redux";
import type { RootState } from "@store/store";
import type { ChatMessage } from "@core/chat/types";
import { resolveChatRoll, setChatRollDecisions } from "@store/encounterSlice";
import { isPersistenceWritable } from "@store/persistenceWriteGuardMiddleware";
import { rollFormulas } from "@core/dice/workerClient";
import { usePersistence } from "@ui/persistence/PersistenceProvider";
import { StatusDialog } from "@ui/panels/status_panel/StatusDialog";
import { DICE_BUTTON, DICE_INPUT, DiceIconButton } from "./DiceIconButton";
import { rollWithPresentation } from "./rollWithPresentation";

/** Only freshly launched rolls open automatically; saved pending rolls resume explicitly. */
export function RollResolution({ message }: { message: ChatMessage }) {
  const [open, setOpen] = useState(() => newlyPendingRolls.has(message.id));
  useEffect(() => { newlyPendingRolls.delete(message.id); }, [message.id]);
  const { readOnly } = usePersistence();
  return <div className="mt-2"><button type="button" className={DICE_BUTTON} disabled={readOnly} onClick={() => setOpen(true)}>Resolve Success / Failure</button>
    {open ? <ResolutionDialog message={message} onClose={() => setOpen(false)} /> : null}
  </div>;
}
export function ResolutionDialog({ message, onClose }: { message: ChatMessage; onClose: () => void }) {
  const invocation = message.invocation!;
  const store = useStore<RootState>();
  const [session] = useState(store.getState().encounterLog.encounterSession);
  const [decisions, setDecisions] = useState(invocation.decisions);
  const [formula, setFormula] = useState(invocation.rollable.effectFormula);
  const [edit, setEdit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  const targets = invocation.targets.length ? invocation.targets : [{ id: "untargeted", name: "Check" }];
  async function finish(next = decisions) {
    if (active.current || !isPersistenceWritable() || targets.some(t => !next[t.id])) return;
    const controller = new AbortController(); active.current = controller; setBusy(true); setError("");
    try {
      const hit = targets.some(t => next[t.id] === "hit");
      const rolls = hit ? await rollWithPresentation([formula], controller.signal, rollFormulas) : [];
      const current = store.getState();
      if (controller.signal.aborted || !isPersistenceWritable() || current.encounterLog.encounterSession !== session || current.encounter.present.chatMessages.byId[message.id]?.invocation?.phase !== "pending") return;
      rolls.forEach(r => { r.role = "effect"; });
      store.dispatch(resolveChatRoll({ id: message.id, invocation: { ...invocation, decisions: next, phase: "resolved" }, rolls })); onClose();
    } catch (error) { setError(error instanceof Error ? error.message : "Could not resolve roll."); }
    finally { active.current = null; setBusy(false); }
  }
  function decide(id: string, value: "hit" | "miss") {
    const next = { ...decisions, [id]: value }; setDecisions(next);
    store.dispatch(setChatRollDecisions({ id: message.id, decisions: next }));
    // A single target resolves and rolls its effect immediately on success.
    if (targets.length === 1) void finish(next);
  }
  const attackResult = message.rolls?.find(result => result.role === "check")?.node.value;
  return <StatusDialog title={edit ? "Edit effect roll" : invocation.checkRollMode === "perTarget" ? "Check results" : `Check result: ${attackResult ?? "—"}`} onClose={onClose} cancelOnBackdrop>
    {edit ? <><label>Effect roll<input className={`${DICE_INPUT} mt-2`} aria-label="Effect roll" value={formula} disabled={busy} onChange={e => setFormula(e.target.value)} /></label>
      <div className="mt-3 flex items-center justify-between gap-2">
        <DiceIconButton label="Back" disabled={busy} onClick={() => setEdit(false)}><Undo2 className="h-4 w-4" /></DiceIconButton>
        <DiceIconButton label="Revert to original" disabled={busy || formula === invocation.rollable.effectFormula} onClick={() => setFormula(invocation.rollable.effectFormula)}><RotateCcw className="h-4 w-4" /></DiceIconButton>
        <DiceIconButton label="Roll" disabled={busy || !formula.trim() || targets.length > 1 && targets.some(t => !decisions[t.id])} onClick={() => void finish(targets.length === 1 ? { [targets[0].id]: "hit" } : decisions)}><Dices className="h-4 w-4" /></DiceIconButton>
      </div>
    </> : <>{targets.map(t => <div className="my-2 flex flex-wrap items-center justify-between gap-2" key={t.id}><span className="min-w-0 break-words">{t.name}{invocation.checkRollMode === "perTarget" ? <span className="ml-2 font-semibold">{message.rolls?.find(result => result.role === "check" && result.targetId === t.id)?.node.value}</span> : null}</span><div className="flex items-center gap-1">
      <button type="button" className={`${DICE_BUTTON} ${decisions[t.id] === "miss" ? "bg-canvas-ink text-canvas-on-ink enabled:hover:bg-canvas-ink/80" : ""}`} disabled={busy} aria-pressed={decisions[t.id] === "miss"} onClick={() => decide(t.id, "miss")}>Failure</button>
      <div className="flex items-stretch [&>span]:flex" role="group" aria-label={`Success ${t.name}`}><button type="button" data-dialog-initial-focus={t.id === targets[0].id || undefined} className={`${DICE_BUTTON} !rounded-r-none ${decisions[t.id] === "hit" ? "bg-canvas-ink text-canvas-on-ink enabled:hover:bg-canvas-ink/80" : ""}`} disabled={busy} aria-pressed={decisions[t.id] === "hit"} onClick={() => decide(t.id, "hit")}>Success</button><DiceIconButton className="!rounded-l-none border-l-0" label={`Edit effect roll for ${t.name}`} disabled={busy} onClick={() => { const next = { ...decisions, [t.id]: "hit" as const }; setDecisions(next); store.dispatch(setChatRollDecisions({ id: message.id, decisions: next })); setEdit(true); }}><Pencil className="h-3 w-3" /></DiceIconButton></div>
    </div></div>)}{targets.length > 1 ? <div className="mt-3 flex justify-end"><button type="button" className={DICE_BUTTON} disabled={busy || targets.some(t => !decisions[t.id])} onClick={() => void finish()}>Resolve targets</button></div> : null}</>}
    {error ? <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
  </StatusDialog>;
}
