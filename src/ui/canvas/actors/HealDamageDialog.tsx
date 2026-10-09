import { HeartMinus, HeartPlus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Actor } from "@entities/actor/types";
import { adjustHitPoints } from "@entities/actor/statusMutations";
import { getHitPointAdjustment } from "@entities/actor/hitPointAdjustment";
import { useCombatPreferences } from "@ui/combat_preferences/CombatPreferenceProvider";
import { useInterfacePreferences } from "@ui/interface_preferences/InterfacePreferenceProvider";
import { usePersistence } from "@ui/persistence/PersistenceProvider";
import { useStatusActions } from "@ui/status/useStatusActions";
import { DamageHealingAmountField } from "@ui/panels/status_panel/DamageHealingAmountField";
import { ConfirmStatusDialog, StatusDialog } from "@ui/panels/status_panel/StatusDialog";

/** The amount is a draft; only Apply commits the existing bulk HP command. */
export function HealDamageDialog({ actors, onClose, isCurrent }: { actors: Actor[]; onClose: () => void; isCurrent: () => boolean }) {
  const [amount, setAmount] = useState("1");
  const [pending, setPending] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const active = useRef(true);
  const damageButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const { readOnly } = usePersistence();
  const { rules } = useCombatPreferences();
  const { keepHealDamageDialogOpen } = useInterfacePreferences();
  const commit = useStatusActions();
  const { eligible, skipped, disabledReason } = getHitPointAdjustment(actors, amount, readOnly || busy, rules);
  const sorted = [...actors].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  function close() { active.current = false; onClose(); }
  async function apply(sign: number) {
    if (disabledReason(sign)) return;
    setBusy(true); setPending(null);
    const ids = eligible.map((actor) => actor.id);
    try {
      const applied = await commit("actor.adjustHitPoints", { actorIds: ids, amount: Number(amount) * sign, rules }, (state) => adjustHitPoints(state, ids, Number(amount) * sign, rules), () => active.current && isCurrent());
      if (active.current && applied && !keepHealDamageDialogOpen) close();
    } finally { if (active.current) setBusy(false); }
  }
  return <StatusDialog title="Heal/damage actors" titleContent={<span className="flex flex-wrap justify-evenly gap-x-5 gap-y-2 text-center">{sorted.map((actor) => <span className="min-w-0 break-words" key={actor.id}>{actor.name}</span>)}</span>} onClose={close} cancelOnBackdrop showClose compact closeAboveTitle>
    <div className="mx-auto w-fit max-w-full"><DamageHealingAmountField onConfirmValue={() => damageButton.current?.focus()} initialFocus value={amount} disabled={readOnly || busy} onChange={setAmount} /></div>
    <div className="mt-4 flex justify-center gap-2">{[{ label: "Apply Heal", sign: 1, Icon: HeartPlus }, { label: "Apply Damage", sign: -1, Icon: HeartMinus }].map(({ label, sign, Icon }) => <button ref={sign === -1 ? damageButton : undefined} key={label} title={disabledReason(sign) || label} disabled={!!disabledReason(sign)} className="flex min-w-0 items-center justify-center gap-2 rounded-xl border border-canvas-line px-3 py-2 text-sm enabled:hover:bg-canvas-surface focus-visible:ring-2 focus-visible:ring-canvas-ink disabled:cursor-not-allowed disabled:text-canvas-muted disabled:opacity-40" onClick={() => { if (skipped.length) setPending(sign); else void apply(sign); }} type="button"><Icon aria-hidden="true" className="h-4 w-4 shrink-0" />{label}</button>)}</div>
    {!eligible.length ? <p className="mt-3 text-center text-xs text-canvas-muted">Configure hit points for a selected actor first.</p> : null}
    {pending !== null ? <ConfirmStatusDialog title="Skip actors without hit points?" confirmLabel="Continue" onClose={() => setPending(null)} onConfirm={() => void apply(pending)}><p>The following actors have no configured hit points and will be skipped:</p><ul className="mt-2 list-disc pl-5">{skipped.map((actor) => <li key={actor.id}>{actor.name}</li>)}</ul></ConfirmStatusDialog> : null}
  </StatusDialog>;
}
