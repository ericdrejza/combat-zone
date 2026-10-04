import { getAvailableCounterName } from "@entities/actor/counterNames";
import { Minus, Pencil, Plus } from "lucide-react";
import { useState } from "react";
import type { Actor } from "@entities/actor/types";
import type { ActorCounter } from "@entities/actor/actorResources";
import { InlineResourceValue } from "./InlineResourceValue";
import { CounterBatchEditor } from "./CounterBatchEditor";
import { CounterEditor } from "./CounterEditor";
import { ConfirmStatusDialog } from "./StatusDialog";

type Props = { actor: Actor; disabled: boolean; onSave: (counter: ActorCounter, useDefaultName?: boolean) => void; onAdjust: (id: string, amount: number) => void; onSaveBatch: (counters: ActorCounter[], removedIds: string[]) => void };
export function CounterControls({ actor, disabled, onSave, onAdjust, onSaveBatch }: Props) {
  const [editing, setEditing] = useState<"add" | "edit" | null>(null);
  const [resetId, setResetId] = useState<string | null>(null);
  const counterIds = actor.counters?.allIds ?? [];
  const resetCounter = resetId ? actor.counters?.byId[resetId] : undefined;
  return <section aria-label="Custom counters" className="space-y-2 border-t border-canvas-line pt-3">
    <div className="flex items-center justify-between"><h3 className="text-base font-semibold">Custom counters</h3>
      <div className="flex items-center gap-1">
      <button aria-label="Edit counters" title="Edit counters" disabled={disabled} className="rounded p-2 enabled:hover:bg-canvas-surface enabled:hover:text-canvas-ink disabled:cursor-not-allowed disabled:border-canvas-line disabled:bg-canvas-surface disabled:text-canvas-muted disabled:opacity-40" onClick={() => setEditing("edit")} type="button"><Pencil aria-hidden="true" className="h-4 w-4" /></button>
      <button aria-label="Add counter" title="Add counter" disabled={disabled} className="rounded p-2 enabled:hover:bg-canvas-surface enabled:hover:text-canvas-ink disabled:cursor-not-allowed disabled:border-canvas-line disabled:bg-canvas-surface disabled:text-canvas-muted disabled:opacity-40" onClick={() => setEditing("add")} type="button"><Plus aria-hidden="true" className="h-4 w-4" /></button>
      </div>
    </div>
    {(actor.counters?.allIds ?? []).map((id) => {
      const counter = actor.counters!.byId[id];
      return <div key={id} className="flex flex-wrap items-center gap-1 text-base" role="group" aria-label={counter.name}>
        <span className="mr-auto">{counter.name}</span>
        <button aria-label={`Decrease ${counter.name}`} title={counter.minimum !== undefined && counter.value <= counter.minimum ? "Minimum reached" : `Decrease ${counter.name}`} disabled={disabled || counter.value <= (counter.minimum ?? -Infinity)} className="rounded p-1 enabled:hover:bg-canvas-surface enabled:hover:text-canvas-ink disabled:cursor-not-allowed disabled:border-canvas-line disabled:bg-canvas-surface disabled:text-canvas-muted disabled:opacity-40" onClick={() => onAdjust(id, -1)} type="button"><Minus aria-hidden="true" className="h-4 w-4" /></button>
        <InlineResourceValue value={counter.value} label={`Edit ${counter.name} value`} disabled={disabled} onSave={(value) => onSave({ ...counter, value })} />
        <button aria-label={`Increase ${counter.name}`} title={counter.maximum !== undefined && counter.value >= counter.maximum ? "Maximum reached" : `Increase ${counter.name}`} disabled={disabled || counter.value >= (counter.maximum ?? Infinity)} className="rounded p-1 enabled:hover:bg-canvas-surface enabled:hover:text-canvas-ink disabled:cursor-not-allowed disabled:border-canvas-line disabled:bg-canvas-surface disabled:text-canvas-muted disabled:opacity-40" onClick={() => onAdjust(id, 1)} type="button"><Plus aria-hidden="true" className="h-4 w-4" /></button>
        {counter.maximum !== undefined ? <span>/ <button aria-label={`Reset ${counter.name} to maximum`} title="Reset current to maximum" className="rounded underline decoration-dotted enabled:hover:bg-canvas-surface enabled:hover:decoration-solid disabled:cursor-not-allowed disabled:border-canvas-line disabled:bg-canvas-surface disabled:text-canvas-muted disabled:opacity-40" disabled={disabled} onClick={() => setResetId(id)} type="button">{counter.maximum}</button></span> : null}
      </div>;
    })}
    {editing === "add" ? <CounterEditor defaultName={getAvailableCounterName(actor.counters)} onClose={() => setEditing(null)} onSave={(counter, useDefaultName) => { onSave(counter, useDefaultName); setEditing(null); }} /> : null}
    {editing === "edit" ? <CounterBatchEditor counters={counterIds.map((id) => actor.counters!.byId[id])} onClose={() => setEditing(null)} onSave={(counters, removedIds) => { onSaveBatch(counters, removedIds); setEditing(null); }} /> : null}
    {resetCounter?.maximum !== undefined ? <ConfirmStatusDialog focusConfirm title={`Reset ${resetCounter.name}?`} onClose={() => setResetId(null)} onConfirm={() => { onSave({ ...resetCounter, value: resetCounter.maximum! }); setResetId(null); }}><p>Reset {resetCounter.name} to its maximum?</p></ConfirmStatusDialog> : null}
  </section>;
}
