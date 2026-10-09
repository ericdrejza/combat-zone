import { getAvailableCounterName } from "@core/entity_resources/counters";
import { useState } from "react";
import type { ClockCounter as Counter } from "@core/entity_resources/statusResources";
import { DEFAULT_CLOCK_STYLE, type ClockStyle } from "@core/entity_resources/clockStyle";
import { CounterEditor, createCounterDraft, isCounterDraftValid, resolveCounterDraft, type CounterDraft } from "./CounterEditor";
import { StatusDialog } from "./StatusDialog";

/** All counter edits stay local until one save commits the complete draft. */
export function CounterBatchEditor({ counters, kind = "counter", defaultClockStyle = DEFAULT_CLOCK_STYLE, initialSelectedId, onClose, onSave }: {
  counters: Counter[];
  initialSelectedId?: string;
  kind?: "counter" | "clock";
  defaultClockStyle?: ClockStyle;
  onClose: () => void;
  onSave: (counters: Counter[], removedIds: string[]) => void;
}) {
  const plural = kind === "clock" ? "clocks" : "counters";
  const prefix = kind === "clock" ? "Clock" : "Counter";
  const [originals] = useState(() => counters);
  const [entries, setEntries] = useState(() => counters);
  const [drafts, setDrafts] = useState<Record<string, CounterDraft>>(() => Object.fromEntries(counters.map((counter) => [counter.id, createCounterDraft(counter)])));
  const [selectedId, setSelectedId] = useState(() => counters.find((counter) => counter.id === initialSelectedId)?.id ?? counters[0]?.id);
  const [confirmClose, setConfirmClose] = useState(false);
  const remaining = entries.filter((counter) => drafts[counter.id]);
  const isNew = (id: string) => !originals.some((counter) => counter.id === id);
  const changed = entries.filter((counter) => isNew(counter.id) ? !!drafts[counter.id] : JSON.stringify(drafts[counter.id]) !== JSON.stringify(createCounterDraft(counter)));
  const valid = remaining.every((counter) => isCounterDraftValid(drafts[counter.id], isNew(counter.id) ? counter.name : "", kind));
  const selected = entries.find((counter) => counter.id === selectedId);
  function requestClose() { if (changed.length) setConfirmClose(true); else onClose(); }
  function createCounter() {
    const name = getAvailableCounterName({ allIds: remaining.map(({ id }) => id), byId: Object.fromEntries(remaining.map((counter) => [counter.id, { ...counter, name: drafts[counter.id].name.trim() || counter.name }])) }, prefix);
    const counter = { id: crypto.randomUUID(), name, value: 0, ...(kind === "clock" ? { minimum: 0, maximum: 4, style: defaultClockStyle } : {}) };
    setEntries([...entries, counter]);
    setDrafts({ ...drafts, [counter.id]: { ...createCounterDraft(counter), name: "" } });
    setSelectedId(counter.id);
  }
  function save() {
    if (!valid) return;
    const resolved = remaining.map((counter) => resolveCounterDraft(counter.id, drafts[counter.id]));
    // Reserve explicit names first, so automatic names never conflict with this draft.
    const named = { allIds: resolved.filter((counter) => counter.name).map(({ id }) => id), byId: Object.fromEntries(resolved.filter((counter) => counter.name).map((counter) => [counter.id, counter])) };
    for (const counter of resolved) {
      if (!counter.name) {
        counter.name = getAvailableCounterName(named, prefix);
        named.allIds.push(counter.id);
        named.byId[counter.id] = counter;
      }
    }
    onSave(resolved.filter((counter) => changed.some((entry) => entry.id === counter.id)), originals.filter((counter) => !drafts[counter.id]).map((counter) => counter.id));
  }
  function removeSelected() {
    const next = { ...drafts };
    delete next[selectedId];
    setDrafts(next);
    setSelectedId(remaining.find((counter) => counter.id !== selectedId)?.id ?? "");
  }
  return <>
    {selected && drafts[selectedId] ? <CounterEditor kind={kind} defaultClockStyle={defaultClockStyle} title={`Edit ${plural}`} counter={isNew(selectedId) ? undefined : selected} defaultName={selected.name} draft={drafts[selectedId]}
      onDraftChange={(draft) => setDrafts({ ...drafts, [selectedId]: draft })} onClose={requestClose} onSave={save} saveDisabled={!valid}
      onRemove={removeSelected} selector={<label className="block text-sm">{prefix}
        <div className="mt-1 flex items-center gap-2">
          <select aria-label={`${prefix} to edit`} className="w-full rounded border border-canvas-line bg-canvas p-2 enabled:hover:border-canvas-ink" value={selectedId} onChange={(event) => { if (event.currentTarget.value === "") createCounter(); else setSelectedId(event.currentTarget.value); }}>
            {remaining.map((counter) => <option key={counter.id} value={counter.id}>{drafts[counter.id].name || counter.name}{changed.some((item) => item.id === counter.id) ? " ✎" : ""}</option>)}
            <option value="">Create new {kind}</option>
          </select>
        </div>
      </label>} /> : <StatusDialog title={`Edit ${plural}`} onClose={requestClose}>
        <label className="block text-sm">{prefix}<select aria-label={`${prefix} to edit`} value="" className="mt-1 w-full rounded border border-canvas-line bg-canvas p-2 hover:border-canvas-ink" onChange={createCounter}>
          <option value="" disabled>Select a {kind}</option><option value="create">Create new {kind}</option>
        </select></label>
        <p className="mt-3 text-sm">{originals.length ? `All ${plural} will be removed when you save.` : `No ${plural} yet. Choose Create new ${kind} to add one.`}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button className="rounded border border-canvas-line p-2 hover:bg-canvas-surface" onClick={requestClose} type="button">Cancel</button>
          <button className="rounded bg-canvas-ink p-2 text-canvas-on-ink hover:bg-canvas-ink/80" onClick={save} type="button">Save</button>
        </div>
      </StatusDialog>}
    {confirmClose ? <StatusDialog cancelOnBackdrop title={`Unsaved ${kind} changes`} onClose={() => setConfirmClose(false)}>
      <p className="text-sm">Save your {kind} changes or discard them before closing?</p>
      {!valid ? <p className="mt-2 text-sm text-canvas-muted">Correct invalid {kind} values before saving.</p> : null}
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button className="rounded border border-canvas-line p-2 hover:bg-canvas-surface" onClick={() => setConfirmClose(false)} type="button">Keep editing</button>
        <button className="rounded border border-canvas-line p-2 hover:bg-canvas-surface" onClick={onClose} type="button">Discard changes</button>
        <button className="rounded bg-canvas-ink p-2 text-canvas-on-ink enabled:hover:bg-canvas-ink/80 disabled:cursor-not-allowed disabled:bg-canvas-surface disabled:text-canvas-muted disabled:opacity-40" disabled={!valid} onClick={save} type="button">Save changes</button>
      </div>
    </StatusDialog> : null}
  </>;
}
