import { useState, type ReactNode } from "react";
import type { ActorCounter } from "@entities/actor/actorResources";
import { CounterValueField } from "./CounterValueField";
import { CounterNumberField } from "./CounterNumberField";
import { StatusDialog } from "./StatusDialog";

export type CounterDraft = { name: string; value: string; minimum: string; maximum: string };
export function createCounterDraft(counter?: ActorCounter): CounterDraft {
  return { name: counter?.name ?? "", value: String(counter?.value ?? 0),
    minimum: counter?.minimum === undefined ? "" : String(counter.minimum),
    maximum: counter?.maximum === undefined ? "" : String(counter.maximum) };
}
export function isCounterDraftValid(draft: CounterDraft, defaultName = ""): boolean {
  return !!(draft.name.trim() || defaultName) && draft.value.trim() !== "" && Number.isSafeInteger(Number(draft.value)) &&
    [draft.minimum, draft.maximum].every((bound) => !bound.trim() || Number.isSafeInteger(Number(bound))) &&
    (draft.minimum.trim() ? Number(draft.minimum) : -Infinity) <= (draft.maximum.trim() ? Number(draft.maximum) : Infinity);
}
export function resolveCounterDraft(id: string, draft: CounterDraft): ActorCounter {
  return { id, name: draft.name.trim(), value: Number(draft.value),
    ...(draft.minimum.trim() ? { minimum: Number(draft.minimum) } : {}),
    ...(draft.maximum.trim() ? { maximum: Number(draft.maximum) } : {}) };
}

export function CounterEditor({ counter, defaultName, selector, onClose, onSave, onRemove, draft: controlledDraft, onDraftChange, saveDisabled = false, title }: {
  title?: string;
  counter?: ActorCounter;
  defaultName: string;
  selector?: ReactNode;
  onClose: () => void;
  onSave: (counter: ActorCounter, useDefaultName: boolean) => void;
  onRemove?: () => void;
  draft?: CounterDraft;
  onDraftChange?: (draft: CounterDraft) => void;
  saveDisabled?: boolean;
}) {
  const [localDraft, setLocalDraft] = useState(() => createCounterDraft(counter));
  const draft = controlledDraft ?? localDraft;
  const { name, value, minimum, maximum } = draft;
  const min = minimum.trim() === "" ? undefined : Number(minimum);
  const max = maximum.trim() === "" ? undefined : Number(maximum);
  const resolvedName = name.trim() || (counter ? "" : defaultName);
  const valid = isCounterDraftValid(draft, counter ? "" : defaultName);
  function update(field: keyof CounterDraft, next: string) {
    const updated = { ...draft, [field]: next };
    if (onDraftChange) onDraftChange(updated);
    else setLocalDraft(updated);
  }
  return <StatusDialog title={title ?? (counter ? "Edit counters" : "Add counter")} onClose={onClose}>
    <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); if (valid && !saveDisabled) onSave({ id: counter?.id ?? crypto.randomUUID(), name: resolvedName, value: Number(value), ...(min === undefined ? {} : { minimum: min }), ...(max === undefined ? {} : { maximum: max }) }, !counter && !name.trim()); }}>
      {selector}
      <label className="block text-sm">Name<input aria-label="Counter name" className="mt-1 w-full rounded border border-canvas-line bg-canvas p-2" placeholder={counter ? undefined : defaultName} value={name} onChange={(event) => update("name", event.currentTarget.value)} /></label>
      <CounterValueField value={value} minimum={min} maximum={max} onChange={(next) => update("value", next)} />
      <CounterNumberField label="Minimum (optional)" name="minimum" value={minimum} optional onChange={(next) => update("minimum", next)} />
      <CounterNumberField label="Maximum (optional)" name="maximum" value={maximum} emptyIncrementValue={1} optional onChange={(next) => update("maximum", next)} />
      {!valid ? <p className="text-xs text-canvas-muted">{counter ? "Enter a name, whole numbers, and a minimum no greater than maximum." : "Enter whole numbers and a minimum no greater than maximum."}</p> : null}
      <div className="flex flex-wrap justify-end gap-2">
        {onRemove ? <button className="mr-auto rounded border border-canvas-line p-2 text-red-700 enabled:hover:bg-canvas-surface" onClick={onRemove} type="button">Remove counter</button> : null}
        <button type="button" onClick={onClose} className="rounded border border-canvas-line p-2 enabled:hover:bg-canvas-surface">Cancel</button>
        <button type="submit" disabled={!valid || saveDisabled} className="rounded bg-canvas-ink p-2 text-canvas-on-ink enabled:hover:bg-canvas-ink/80 disabled:cursor-not-allowed disabled:border-canvas-line disabled:bg-canvas-surface disabled:text-canvas-muted disabled:opacity-40">Save</button>
      </div>
    </form>
  </StatusDialog>;
}
