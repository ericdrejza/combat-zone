import { ApplyRollActorPicker, APPLY_FACTIONS } from "./ApplyRollActorPicker";
import { RollApplicationAmount } from "./RollApplicationAmount";
import { TouchTooltip } from "@ui/toolbar/TouchTooltip";
import { HeartMinus, HeartPlus, UsersRound } from "lucide-react";
import { useState } from "react";
import { useSelector, useStore } from "react-redux";
import type { RootState } from "@store/store";
import type { ChatMessage } from "@core/chat/types";
import type { DiceResult } from "@core/dice/types";
import { applyRollResult } from "@entities/actor/rollableMutations";
import { useCombatPreferences } from "@ui/combat_preferences/CombatPreferenceProvider";
import { usePersistence } from "@ui/persistence/PersistenceProvider";
import { useStatusActions } from "@ui/status/useStatusActions";
import { ConfirmStatusDialog, StatusDialog } from "@ui/panels/status_panel/StatusDialog";
import { DICE_BUTTON, DiceIconButton } from "./DiceIconButton";
import { previewDiceTarget } from "./MentionSuggestions";

export function RollApplicationControls({ message, result }: { message: ChatMessage; result: DiceResult }) {
  const [kind, setKind] = useState<"healing" | "damage" | null>(null);
  const { readOnly } = usePersistence();
  const effectKind = result.role === "effect" ? message.invocation?.rollable.effectKind : undefined;
  if (message.invocation?.rollable.effectKind === "none") return null;
  return <div className="flex flex-wrap items-center gap-2">
    {(!effectKind || effectKind === "damage") ? <DiceIconButton label="Apply Damage" disabled={readOnly} onClick={() => setKind("damage")}><HeartMinus className="h-4 w-4" /></DiceIconButton> : null}
    {(!effectKind || effectKind === "healing") ? <DiceIconButton label="Apply Healing" disabled={readOnly} onClick={() => setKind("healing")}><HeartPlus className="h-4 w-4" /></DiceIconButton> : null}
    {kind ? <ApplyRollDialog key={kind} kind={kind} message={message} result={result} onClose={() => { previewDiceTarget(null); setKind(null); }} /> : null}
  </div>;
}
function ApplyRollDialog({ kind, message, result, onClose }: { kind: "healing" | "damage"; message: ChatMessage; result: DiceResult; onClose: () => void }) {
  const encounter = useSelector((s: RootState) => s.encounter.present);
  const session = useSelector((s: RootState) => s.encounterLog.encounterSession);
  const store = useStore<RootState>();
  const [initialSession] = useState(session);
  const [grouped, setGrouped] = useState(true);
  const [selected, setSelected] = useState(() => new Set(message.invocation?.targets.filter(t => message.invocation?.decisions[t.id] !== "miss").map(t => t.id) ?? []));
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { readOnly } = usePersistence();
  const { rules } = useCombatPreferences();
  const commit = useStatusActions();
  const label = kind === "damage" ? "Apply Damage" : "Apply Healing";
  const factions = APPLY_FACTIONS;
  const actors = encounter.actors.allIds.map(id => encounter.actors.byId[id]).sort((a, b) => (!grouped ? 0 : factions.indexOf(a.layoutGroup) - factions.indexOf(b.layoutGroup)) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  const eligible = actors.filter(a => selected.has(a.id) && a.hitPoints);
  const value = (id: string) => amounts[id] ?? String(result.node.value);
  const valid = eligible.length > 0 && eligible.every(a => value(a.id).trim() && Number.isSafeInteger(Number(value(a.id))) && Number(value(a.id)) > 0);
  const appliedActors = new Set(encounter.rollApplications.allIds.map(id => encounter.rollApplications.byId[id]).filter(receipt => receipt.resultId === result.id).map(receipt => receipt.actorId));
  const prior = eligible.some(actor => appliedActors.has(actor.id));
  async function apply() {
    if (!valid || busy || readOnly) return;
    setBusy(true); setError(""); setConfirm(false);
    const applications = eligible.map(a => ({ id: crypto.randomUUID(), resultId: result.id, actorId: a.id, kind, amount: Number(value(a.id)) }));
    try {
      const applied = await commit("actor.adjustRollHitPoints", { applications, rules }, state => applyRollResult(state, applications, rules), () => store.getState().encounterLog.encounterSession === initialSession && !!store.getState().encounter.present.chatMessages.byId[message.id]);
      if (applied) onClose(); else setError("No hit points changed. Check the current limits, targets, and validation messages.");
    } catch (error) { setError(error instanceof Error ? error.message : "Could not apply result."); }
    finally { setBusy(false); }
  }
  return <StatusDialog title={label} onClose={onClose} cancelOnBackdrop headerActions={<TouchTooltip label="Group by faction"><button type="button" aria-label="Group by faction" title="Group by faction" aria-pressed={grouped} disabled={busy || readOnly} onClick={() => setGrouped(value => !value)}
    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border focus-visible:ring-2 focus-visible:ring-canvas-ink disabled:cursor-not-allowed disabled:text-canvas-muted disabled:opacity-40 ${grouped ? "border-canvas-ink bg-canvas-ink text-canvas-on-ink enabled:hover:bg-canvas-ink/80" : "border-canvas-line enabled:hover:bg-canvas-surface"}`}><UsersRound aria-hidden="true" className="h-4 w-4" /></button></TouchTooltip>}>
    {message.invocation?.targets.some(t => !encounter.actors.byId[t.id]) ? <p className="mb-2 text-sm text-canvas-muted">Unavailable targets: {message.invocation.targets.filter(t => !encounter.actors.byId[t.id]).map(t => t.name).join(", ")}</p> : null}
    <ApplyRollActorPicker applied={appliedActors} actors={actors} grouped={grouped} selected={selected} disabled={busy || readOnly}
      onToggle={id => setSelected(previous => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; })}
      renderAmount={actor => <RollApplicationAmount name={actor.name} value={value(actor.id)} editing={editing === actor.id} disabled={busy || readOnly}
        onChange={amount => setAmounts(previous => ({ ...previous, [actor.id]: amount }))} onEdit={() => setEditing(previous => previous === actor.id ? null : actor.id)} />} />
    {!valid && eligible.length ? <p role="alert" className="mt-2 text-sm">Use the pencil to enter a positive whole-number amount for each target.</p> : null}
    {error ? <p role="alert" className="mt-2 text-sm">{error}</p> : null}
    <div className="mt-4 flex justify-end gap-2"><button className={DICE_BUTTON} type="button" onClick={onClose}>Cancel</button><button className={DICE_BUTTON} type="button" disabled={!valid || busy || readOnly} onClick={() => prior ? setConfirm(true) : void apply()}>{label}</button></div>
    {confirm ? <ConfirmStatusDialog title="Apply this result again?" confirmLabel={label} onClose={() => setConfirm(false)} onConfirm={() => void apply()}><p>This result has already been applied to at least one selected actor.</p></ConfirmStatusDialog> : null}
  </StatusDialog>;
}
