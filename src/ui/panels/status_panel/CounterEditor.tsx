import { ClockStyleSelect } from "@ui/controls/ClockStyleSelect";
import { isClockStyle } from "@core/entity_resources/clockStyle";
import { useState, type ReactNode } from "react";
import type { ClockCounter as Counter } from "@core/entity_resources/statusResources";
import { DEFAULT_CLOCK_STYLE, type ClockStyle } from "@core/entity_resources/clockStyle";
import { CounterValueField } from "./CounterValueField";
import { CounterNumberField } from "./CounterNumberField";
import { StatusDialog } from "./StatusDialog";

export type CounterDraft = { name: string; value: string; minimum: string; maximum: string; style?: ClockStyle };
export function createCounterDraft(counter?: Counter): CounterDraft {
  return { name: counter?.name ?? "", value: String(counter?.value ?? 0),
    minimum: counter?.minimum === undefined ? "" : String(counter.minimum),
    maximum: counter?.maximum === undefined ? "" : String(counter.maximum),
    ...(counter?.style === undefined ? {} : { style: counter.style }) };
}
export function isCounterDraftValid(draft: CounterDraft, defaultName = "", kind: "counter" | "clock" = "counter"): boolean {
  return !!(draft.name.trim() || defaultName) && draft.value.trim() !== "" && Number.isSafeInteger(Number(draft.value)) &&
    [draft.minimum, draft.maximum].every((bound) => !bound.trim() || Number.isSafeInteger(Number(bound))) &&
    (draft.minimum.trim() ? Number(draft.minimum) : -Infinity) <= (draft.maximum.trim() ? Number(draft.maximum) : Infinity) &&
    (kind !== "clock" || (Number.isSafeInteger(Number(draft.maximum)) && Number(draft.maximum) >= 1 && Number(draft.maximum) <= 12 && (draft.style === undefined || isClockStyle(draft.style))));
}
export function resolveCounterDraft(id: string, draft: CounterDraft): Counter {
  return { id, name: draft.name.trim(), value: Number(draft.value),
    ...(draft.minimum.trim() ? { minimum: Number(draft.minimum) } : {}),
    ...(draft.maximum.trim() ? { maximum: Number(draft.maximum) } : {}),
    ...(draft.style === undefined ? {} : { style: draft.style }) };
}

export function CounterEditor({ kind = "counter", defaultClockStyle = DEFAULT_CLOCK_STYLE, counter, defaultName, selector, onClose, onSave, onRemove, draft: controlledDraft, onDraftChange, saveDisabled = false, title }: {
  kind?: "counter" | "clock";
  defaultClockStyle?: ClockStyle;
  title?: string;
  counter?: Counter;
  defaultName: string;
  selector?: ReactNode;
  onClose: () => void;
  onSave: (counter: Counter, useDefaultName: boolean) => void;
  onRemove?: () => void;
  draft?: CounterDraft;
  onDraftChange?: (draft: CounterDraft) => void;
  saveDisabled?: boolean;
}) {
  const [localDraft, setLocalDraft] = useState(() => kind === "clock" && !counter ? { ...createCounterDraft(), minimum: "0", maximum: "4", style: defaultClockStyle } : createCounterDraft(counter));
  const draft = controlledDraft ?? localDraft;
  const { name, value, minimum, maximum } = draft;
  const min = minimum.trim() === "" ? undefined : Number(minimum);
  const max = maximum.trim() === "" ? undefined : Number(maximum);
  const resolvedName = name.trim() || (counter ? "" : defaultName);
  const valid = isCounterDraftValid(draft, counter ? "" : defaultName, kind);
  const plural = kind === "clock" ? "clocks" : "counters";
  function update(field: keyof CounterDraft, next: string) {
    const updated = { ...draft, [field]: next };
    if (kind === "clock" && field === "maximum" && Number.isSafeInteger(Number(next)) && Number(next) >= 1 && Number(next) <= 12) updated.value = String(Math.min(Number(updated.value), Number(next)));
    if (onDraftChange) onDraftChange(updated);
    else setLocalDraft(updated);
  }
  return <StatusDialog title={title ?? (counter ? `Edit ${plural}` : `Add ${kind}`)} onClose={onClose}>
    <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); if (valid && !saveDisabled) onSave({ id: counter?.id ?? crypto.randomUUID(), name: resolvedName, value: Number(value), ...(min === undefined ? {} : { minimum: min }), ...(max === undefined ? {} : { maximum: max }), ...(kind === "clock" ? { style: draft.style ?? DEFAULT_CLOCK_STYLE } : {}) }, !counter && !name.trim()); }}>
      {selector}
      <label className="block text-sm">Name<input aria-label={kind === "clock" ? "Clock name" : "Counter name"} className="mt-1 w-full rounded border border-canvas-line bg-canvas p-2 enabled:hover:border-canvas-ink focus-visible:ring-2 focus-visible:ring-canvas-ink" placeholder={counter ? undefined : defaultName} value={name} onChange={(event) => update("name", event.currentTarget.value)} /></label>
      {kind === "clock" ? <ClockStyleSelect label="Clock style" value={draft.style ?? DEFAULT_CLOCK_STYLE} onChange={(style) => update("style", style)} /> : null}
      <CounterValueField value={value} minimum={min} maximum={max} onChange={(next) => update("value", next)} />
      {kind === "counter" ? <CounterNumberField label="Minimum (optional)" name="minimum" value={minimum} optional onChange={(next) => update("minimum", next)} /> : null}
      <CounterNumberField label={kind === "clock" ? "Segments (1–12)" : "Maximum (optional)"} name={kind === "clock" ? "segments" : "maximum"} value={maximum} minimum={kind === "clock" ? 1 : undefined} maximum={kind === "clock" ? 12 : undefined} emptyIncrementValue={1} optional={kind === "counter"} onChange={(next) => update("maximum", next)} />
      {!valid ? <p className="text-xs text-canvas-muted">{kind === "clock" ? "Enter whole-number progress and 1–12 segments." : counter ? "Enter a name, whole numbers, and a minimum no greater than maximum." : "Enter whole numbers and a minimum no greater than maximum."}</p> : null}
      <div className="flex flex-wrap justify-end gap-2">
        {onRemove ? <button className="mr-auto rounded border border-canvas-line p-2 text-red-700 dark:text-red-500 enabled:hover:bg-canvas-surface" onClick={onRemove} type="button">Remove {kind}</button> : null}
        <button type="button" onClick={onClose} className="rounded border border-canvas-line p-2 enabled:hover:bg-canvas-surface">Cancel</button>
        <button type="submit" disabled={!valid || saveDisabled} className="rounded bg-canvas-ink p-2 text-canvas-on-ink enabled:hover:bg-canvas-ink/80 disabled:cursor-not-allowed disabled:border-canvas-line disabled:bg-canvas-surface disabled:text-canvas-muted disabled:opacity-40">Save</button>
      </div>
    </form>
  </StatusDialog>;
}
