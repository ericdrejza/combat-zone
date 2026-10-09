import { SwipeCounterRow } from "./SwipeCounterRow";
import { ClockCardActions } from "./ClockCardActions";
import { ResourceMaximum } from "./ResourceMaximum";
import { RepeatButton } from "@ui/controls/RepeatButton";
import { getAvailableCounterName } from "@core/entity_resources/counters";
import { Minus, Pencil, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import type { EntityCollection } from "@core/state/entityCollection";
import { ClockDisplay } from "./ClockDisplay";
import type { ClockCounter as Counter } from "@core/entity_resources/statusResources";
import { DEFAULT_CLOCK_STYLE, type ClockStyle } from "@core/entity_resources/clockStyle";
import { InlineResourceValue } from "./InlineResourceValue";
import { CounterBatchEditor } from "./CounterBatchEditor";
import { CounterEditor } from "./CounterEditor";
import { ConfirmStatusDialog } from "./StatusDialog";

type Props = { counters?: EntityCollection<Counter>; defaultClockStyle?: ClockStyle; kind?: "counter" | "clock"; disabled: boolean; onSave: (counter: Counter, useDefaultName?: boolean) => void; onAdjust: (id: string, amount: number) => void; onSaveBatch: (counters: Counter[], removedIds: string[]) => void };
export function CounterControls({ counters, kind = "counter", defaultClockStyle = DEFAULT_CLOCK_STYLE, disabled, onSave, onAdjust, onSaveBatch }: Props) {
  const plural = kind === "clock" ? "clocks" : "counters";
  const singular = kind;
  const [editing, setEditing] = useState<{ mode: "add" | "edit"; selectedId?: string } | null>(null);
  const [resetId, setResetId] = useState<string | null>(null);
  const [resetToZero, setResetToZero] = useState(false);
  useEffect(() => { if (disabled) { setEditing(null); setResetId(null); } }, [disabled]);
  const counterIds = counters?.allIds ?? [];
  const resetCounter = resetId ? counters?.byId[resetId] : undefined;
  function requestReset(counter: Counter) {
    setResetId(counter.id);
    // Keep the offered operation fixed while confirmation is open.
    setResetToZero(kind === "clock" && counter.value === counter.maximum);
  }
  return <section aria-label={kind === "clock" ? "Clocks" : "Counters"} className="space-y-2 border-t border-canvas-line pt-3">
    <div className="flex items-center justify-between"><h3 className="text-base font-semibold">{kind === "clock" ? "Clocks" : "Counters"}</h3>
      <div className="flex items-center gap-1">
      <button aria-label={`Edit ${plural}`} title={`Edit ${plural}`} disabled={disabled} className="rounded p-2 enabled:hover:bg-canvas-surface enabled:hover:text-canvas-ink focus-visible:ring-2 focus-visible:ring-canvas-ink disabled:cursor-not-allowed disabled:border-canvas-line disabled:bg-canvas-surface disabled:text-canvas-muted disabled:opacity-40" onClick={() => setEditing({ mode: "edit" })} type="button"><Pencil aria-hidden="true" className="h-4 w-4" /></button>
      <button aria-label={`Add ${singular}`} title={`Add ${singular}`} disabled={disabled} className="rounded p-2 enabled:hover:bg-canvas-surface enabled:hover:text-canvas-ink focus-visible:ring-2 focus-visible:ring-canvas-ink disabled:cursor-not-allowed disabled:border-canvas-line disabled:bg-canvas-surface disabled:text-canvas-muted disabled:opacity-40" onClick={() => setEditing({ mode: "add" })} type="button"><Plus aria-hidden="true" className="h-4 w-4" /></button>
      </div>
    </div>
    {kind !== "clock" || counterIds.length > 0 ? <div className={kind === "clock" ? "grid auto-rows-fr grid-cols-2 gap-2" : "space-y-2"}>
    {(counters?.allIds ?? []).map((id) => {
      const counter = counters!.byId[id];
      const row = <div key={id} className={kind === "clock" ? "group relative flex min-w-0 flex-col items-center justify-between gap-1 rounded-xl border border-canvas-line bg-canvas-surface p-2 text-base" : "flex flex-wrap items-center gap-1 text-base"} role="group" aria-label={counter.name}>
        {kind === "clock" ? <ClockCardActions name={counter.name} disabled={disabled} onEdit={() => setEditing({ mode: "edit", selectedId: id })} onDelete={() => onSaveBatch([], [id])} /> : null}
        <span title={kind === "clock" ? counter.name : undefined} className={kind === "clock" ? "w-full min-w-0 truncate px-4 text-center" : "mr-auto"}>{counter.name}</span>
        {kind === "clock" ? <div className="flex h-12 w-full min-w-0 shrink-0 items-center justify-center">
          <div className={(counter.style === "box" || counter.style === "row") ? "grid w-[calc(100%-1rem)] min-w-0 max-w-20 -translate-x-3 grid-cols-[minmax(0,1fr)_0px] items-center" : "grid grid-cols-[minmax(0,1fr)_0px] items-center"}>
            <ClockDisplay style={counter.style} value={counter.value} segments={counter.maximum!} name={counter.name} />
            <div className="ml-1 w-max">
              <ResourceMaximum resetToZero={counter.value === counter.maximum} name={counter.name} maximum={counter.maximum!} disabled={disabled} onReset={() => requestReset(counter)} />
            </div>
          </div>
        </div> : null}
        <div className={kind === "clock" ? "flex flex-wrap items-center justify-center gap-1" : "contents"}>
        <RepeatButton aria-label={`Decrease ${counter.name}`} title={counter.minimum !== undefined && counter.value <= counter.minimum ? "Minimum reached" : `Decrease ${counter.name}`} disabled={disabled || counter.value <= (counter.minimum ?? -Infinity)} className="rounded p-1 enabled:hover:bg-canvas-surface enabled:hover:text-canvas-ink focus-visible:ring-2 focus-visible:ring-canvas-ink disabled:cursor-not-allowed disabled:border-canvas-line disabled:bg-canvas-surface disabled:text-canvas-muted disabled:opacity-40" onClick={() => onAdjust(id, -1)} type="button"><Minus aria-hidden="true" className="h-4 w-4" /></RepeatButton>
        <InlineResourceValue value={counter.value} label={`Edit ${counter.name} value`} disabled={disabled} onSave={(value) => onSave({ ...counter, value })} />
        <RepeatButton aria-label={`Increase ${counter.name}`} title={counter.maximum !== undefined && counter.value >= counter.maximum ? "Maximum reached" : `Increase ${counter.name}`} disabled={disabled || counter.value >= (counter.maximum ?? Infinity)} className="rounded p-1 enabled:hover:bg-canvas-surface enabled:hover:text-canvas-ink focus-visible:ring-2 focus-visible:ring-canvas-ink disabled:cursor-not-allowed disabled:border-canvas-line disabled:bg-canvas-surface disabled:text-canvas-muted disabled:opacity-40" onClick={() => onAdjust(id, 1)} type="button"><Plus aria-hidden="true" className="h-4 w-4" /></RepeatButton>
        {kind !== "clock" && counter.maximum !== undefined ? <ResourceMaximum name={counter.name} maximum={counter.maximum} disabled={disabled} onReset={() => requestReset(counter)} /> : null}
        </div>
      </div>;
      return kind === "clock" ? row : <SwipeCounterRow key={id} disabled={disabled} onDelete={() => onSaveBatch([], [id])} onEdit={() => setEditing({ mode: "edit", selectedId: id })}>{row}</SwipeCounterRow>;
    })}
    </div> : null}
    {editing?.mode === "add" ? <CounterEditor kind={kind} defaultClockStyle={defaultClockStyle} defaultName={getAvailableCounterName(counters, kind === "clock" ? "Clock" : "Counter")} onClose={() => setEditing(null)} onSave={(counter, useDefaultName) => { onSave(counter, useDefaultName); setEditing(null); }} /> : null}
    {editing?.mode === "edit" ? <CounterBatchEditor initialSelectedId={editing.selectedId} kind={kind} defaultClockStyle={defaultClockStyle} counters={counterIds.map((id) => counters!.byId[id])} onClose={() => setEditing(null)} onSave={(counters, removedIds) => { onSaveBatch(counters, removedIds); setEditing(null); }} /> : null}
    {resetCounter?.maximum !== undefined ? <ConfirmStatusDialog focusConfirm title={`Reset ${resetCounter.name}?`} onClose={() => setResetId(null)} onConfirm={() => { onSave({ ...resetCounter, value: resetToZero ? 0 : resetCounter.maximum! }); setResetId(null); }}><p>Reset {resetCounter.name} to {resetToZero ? "zero" : "its maximum"}?</p></ConfirmStatusDialog> : null}
  </section>;
}
