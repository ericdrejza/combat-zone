import { HeartMinus, HeartPlus, Pencil, Plus, RotateCcw } from "lucide-react";
import { useState } from "react";
import type { Actor } from "@entities/actor/types";
import type { HitPoints } from "@entities/actor/actorResources";
import { useCombatPreferences } from "@ui/combat_preferences/CombatPreferenceProvider";
import { TouchTooltip } from "@ui/toolbar/TouchTooltip";
import { CounterNumberField } from "./CounterNumberField";
import { InlineResourceValue } from "./InlineResourceValue";
import { DamageHealingAmountField } from "./DamageHealingAmountField";
import { ConfirmStatusDialog, StatusDialog } from "./StatusDialog";

export function HitPointControls({ actors, label, disabled, onAdjust, onSet }: {
  actors: Actor[]; label: string; disabled: boolean; onAdjust: (ids: string[], amount: number) => void;
  onSet: (id: string, hp: HitPoints) => void;
}) {
  const { rules } = useCombatPreferences();
  const [amount, setAmount] = useState("1");
  const [editing, setEditing] = useState(false);
  const [reset, setReset] = useState(false);
  const [pending, setPending] = useState<{ ids: string[]; skipped: string[]; amount: number } | null>(null);
  const actor = actors.length === 1 ? actors[0] : undefined;
  const eligible = actors.filter((actor) => actor.hitPoints);
  const validAmount = Number.isSafeInteger(Number(amount)) && Number(amount) > 0;
  const reason = disabled ? "Read-only encounter" : !eligible.length ? "Configure hit points for a selected actor first" : !validAmount ? "Enter a positive whole-number amount" : "";
  function disabledReason(sign: number): string {
    if (reason) return reason;
    if (sign < 0 && rules.limits === "bounded" && eligible.every((actor) => actor.hitPoints!.current <= 0)) {
      return "All selected actors with hit points are at or below the minimum (0)";
    }
    if (sign > 0 && rules.limits !== "unbounded" && eligible.every((actor) => actor.hitPoints!.current >= actor.hitPoints!.maximum)) {
      return "All selected actors with hit points are at or above their maximum";
    }
    return "";
  }
  function adjust(sign: number) {
    const ids = eligible.map((actor) => actor.id);
    const skipped = actors.filter((actor) => !actor.hitPoints).map((actor) => actor.name);
    const value = Number(amount) * sign;
    if (skipped.length) setPending({ ids, skipped, amount: value });
    else onAdjust(ids, value);
  }
  return <section aria-label={label} className="space-y-3 border-t border-canvas-line pt-3">
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-base font-semibold">{label}</h3>
      {actor ? actor.hitPoints ? <span className="ml-auto whitespace-nowrap text-base"><InlineResourceValue value={actor.hitPoints.current} label={`Edit current ${label.toLowerCase()}`} disabled={disabled} onSave={(current) => onSet(actor.id, { ...actor.hitPoints!, current })} /> / <button aria-label={`Reset ${label} to maximum`} title="Reset current to maximum" disabled={disabled} className="rounded underline decoration-dotted enabled:hover:bg-canvas-surface enabled:hover:decoration-solid disabled:cursor-not-allowed disabled:border-canvas-line disabled:bg-canvas-surface disabled:text-canvas-muted disabled:opacity-40" onClick={() => setReset(true)} type="button">{actor.hitPoints.maximum}</button></span> : <span className="ml-auto text-base text-canvas-muted">Not configured</span> : null}
      {actor ? <button aria-label={`Edit ${label}`} title={actor.hitPoints ? `Edit ${label}` : `Configure ${label}`} disabled={disabled} className="rounded p-2 enabled:hover:bg-canvas-surface enabled:hover:text-canvas-ink disabled:cursor-not-allowed disabled:border-canvas-line disabled:bg-canvas-surface disabled:text-canvas-muted disabled:opacity-40" onClick={() => setEditing(true)} type="button">
        {actor.hitPoints ? <Pencil aria-hidden="true" className="h-4 w-4" /> : <Plus aria-hidden="true" className="h-4 w-4" />}
      </button> : null}
    </div>
    {!actor ? actors.map((item) => <div key={item.id} className="flex items-center justify-between gap-2 text-base">
      <span>{item.name}</span>
      {item.hitPoints ? <span>{item.hitPoints.current} / {item.hitPoints.maximum}</span> : <span className="text-canvas-muted">Not configured</span>}
    </div>) : null}
    <div className="flex items-end gap-2">
      <DamageHealingAmountField value={amount} disabled={disabled} onChange={setAmount} />
      {[{ text: "Apply damage", Icon: HeartMinus, sign: -1 }, { text: "Apply healing", Icon: HeartPlus, sign: 1 }].map(({ text, Icon, sign }) => {
        const actionReason = disabledReason(sign);
        const tooltip = actionReason ? `${text}: ${actionReason}` : text;
        return <TouchTooltip key={text} label={tooltip}>
          <button aria-label={text} title={tooltip} disabled={!!actionReason} className="rounded-lg border border-canvas-line p-2 enabled:hover:bg-canvas-surface enabled:hover:text-canvas-ink disabled:cursor-not-allowed disabled:border-canvas-line disabled:bg-canvas-surface disabled:text-canvas-muted disabled:opacity-40" onClick={() => adjust(sign)} type="button"><Icon aria-hidden="true" className="h-5 w-5" /></button>
        </TouchTooltip>;
      })}
    </div>
    {editing && actor ? <HitPointEditor actor={actor} label={label} onClose={() => setEditing(false)} onSave={(hp) => { onSet(actor.id, hp); setEditing(false); }} /> : null}
    {reset && actor?.hitPoints ? <ConfirmStatusDialog focusConfirm title={`Reset ${label}?`} onClose={() => setReset(false)} onConfirm={() => { onSet(actor.id, { ...actor.hitPoints!, current: actor.hitPoints!.maximum }); setReset(false); }}>
      <p>Reset {actor.name} to their maximum {label.toLowerCase()}?</p>
    </ConfirmStatusDialog> : null}
    {pending ? <ConfirmStatusDialog title="Skip actors without hit points?" confirmLabel="Continue" onClose={() => setPending(null)} onConfirm={() => { onAdjust(pending.ids, pending.amount); setPending(null); }}>
      <p>The following actors have no configured hit points and will be skipped:</p><ul className="mt-2 list-disc pl-5">{pending.skipped.map((name, index) => <li key={index}>{name}</li>)}</ul>
    </ConfirmStatusDialog> : null}
  </section>;
}

function HitPointEditor({ actor, label, onClose, onSave }: { actor: Actor; label: string; onClose: () => void; onSave: (hp: HitPoints) => void }) {
  const { rules } = useCombatPreferences();
  const [maximum, setMaximum] = useState(actor.hitPoints ? String(actor.hitPoints.maximum) : "");
  const [current, setCurrent] = useState(actor.hitPoints ? String(actor.hitPoints.current) : "");
  const validMaximum = maximum.trim() !== "" && Number.isSafeInteger(Number(maximum)) && Number(maximum) > 0;
  const valid = validMaximum && current.trim() !== "" && Number.isSafeInteger(Number(current));
  return <StatusDialog title={`Edit ${label === "Hit points" ? "hit points" : label}`} onClose={onClose}>
    <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); if (valid) onSave({ maximum: Number(maximum), current: Number(current) }); }}>
      <CounterNumberField label="Maximum hit points" name="maximum hit points" value={maximum} minimum={1} emptyIncrementValue={1} onChange={(value) => { setMaximum(value); if (!actor.hitPoints && (current === "" || current === maximum)) setCurrent(value); }} />
      <CounterNumberField label="Current hit points" name="current hit points" value={current} minimum={rules.limits === "bounded" ? 0 : undefined} maximum={rules.limits !== "unbounded" && validMaximum ? Number(maximum) : undefined} onChange={setCurrent} beforeDecrement={
        <button aria-label="Reset current hit points to maximum" title={validMaximum ? "Reset current hit points to maximum" : "Enter a positive whole-number maximum first"} disabled={!validMaximum} className="rounded p-2 enabled:hover:bg-canvas-surface enabled:hover:text-canvas-ink focus-visible:ring-2 focus-visible:ring-canvas-ink disabled:cursor-not-allowed disabled:border-canvas-line disabled:bg-canvas-surface disabled:text-canvas-muted disabled:opacity-40" onClick={() => setCurrent(String(Number(maximum)))} type="button"><RotateCcw aria-hidden="true" className="h-4 w-4" /></button>
      } />
      {!valid ? <p className="text-xs text-canvas-muted">Enter whole numbers and a positive maximum.</p> : null}
      <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded border border-canvas-line p-2 enabled:hover:bg-canvas-surface">Cancel</button><button type="submit" disabled={!valid} className="rounded bg-canvas-ink p-2 text-canvas-on-ink enabled:hover:bg-canvas-ink/80 disabled:cursor-not-allowed disabled:border-canvas-line disabled:bg-canvas-surface disabled:text-canvas-muted disabled:opacity-40">Save</button></div>
    </form>
  </StatusDialog>;
}
