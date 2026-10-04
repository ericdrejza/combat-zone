import { getAvailableCounterName } from "@entities/actor/counterNames";
import { useState } from "react";
import type { ActorCounter } from "@entities/actor/actorResources";
import { CounterEditor, createCounterDraft, isCounterDraftValid, resolveCounterDraft, type CounterDraft } from "./CounterEditor";
import { StatusDialog } from "./StatusDialog";

/** All counter edits stay local until one save commits the complete draft. */
export function CounterBatchEditor({ counters, onClose, onSave }: {
  counters: ActorCounter[];
  onClose: () => void;
  onSave: (counters: ActorCounter[], removedIds: string[]) => void;
}) {
  const [originals] = useState(() => counters);
  const [entries, setEntries] = useState(() => counters);
  const [drafts, setDrafts] = useState<Record<string, CounterDraft>>(() => Object.fromEntries(counters.map((counter) => [counter.id, createCounterDraft(counter)])));
  const [selectedId, setSelectedId] = useState(counters[0]?.id);
  const [confirmClose, setConfirmClose] = useState(false);
  const remaining = entries.filter((counter) => drafts[counter.id]);
  const isNew = (id: string) => !originals.some((counter) => counter.id === id);
  const changed = entries.filter((counter) => isNew(counter.id) ? !!drafts[counter.id] : JSON.stringify(drafts[counter.id]) !== JSON.stringify(createCounterDraft(counter)));
  const valid = remaining.every((counter) => isCounterDraftValid(drafts[counter.id], isNew(counter.id) ? counter.name : ""));
  const selected = entries.find((counter) => counter.id === selectedId);
  function requestClose() { if (changed.length) setConfirmClose(true); else onClose(); }
  function createCounter() {
    const name = getAvailableCounterName({ allIds: remaining.map(({ id }) => id), byId: Object.fromEntries(remaining.map((counter) => [counter.id, { ...counter, name: drafts[counter.id].name.trim() || counter.name }])) });
    const counter = { id: crypto.randomUUID(), name, value: 0 };
    setEntries([...entries, counter]);
    setDrafts({ ...drafts, [counter.id]: createCounterDraft() });
    setSelectedId(counter.id);
  }
  function save() {
    if (!valid) return;
    const resolved = remaining.map((counter) => resolveCounterDraft(counter.id, drafts[counter.id]));
    // Reserve explicit names first, so automatic names never conflict with this draft.
    const named = { allIds: resolved.filter((counter) => counter.name).map(({ id }) => id), byId: Object.fromEntries(resolved.filter((counter) => counter.name).map((counter) => [counter.id, counter])) };
    for (const counter of resolved) {
      if (!counter.name) {
        counter.name = getAvailableCounterName(named);
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
    {selected && drafts[selectedId] ? <CounterEditor title="Edit counters" counter={isNew(selectedId) ? undefined : selected} defaultName={selected.name} draft={drafts[selectedId]}
      onDraftChange={(draft) => setDrafts({ ...drafts, [selectedId]: draft })} onClose={requestClose} onSave={save} saveDisabled={!valid}
      onRemove={removeSelected} selector={<label className="block text-sm">Counter
        <div className="mt-1 flex items-center gap-2">
          <select aria-label="Counter to edit" className="w-full rounded border border-canvas-line bg-canvas p-2 enabled:hover:border-canvas-ink" value={selectedId} onChange={(event) => { if (event.currentTarget.value === "") createCounter(); else setSelectedId(event.currentTarget.value); }}>
            {remaining.map((counter) => <option key={counter.id} value={counter.id}>{drafts[counter.id].name || counter.name}{changed.some((item) => item.id === counter.id) ? " ✎" : ""}</option>)}
            <option value="">Create new counter</option>
          </select>
        </div>
      </label>} /> : <StatusDialog title="Edit counters" onClose={requestClose}>
        <label className="block text-sm">Counter<select aria-label="Counter to edit" value="" className="mt-1 w-full rounded border border-canvas-line bg-canvas p-2 hover:border-canvas-ink" onChange={createCounter}>
          <option value="" disabled>Select a counter</option><option value="create">Create new counter</option>
        </select></label>
        <p className="mt-3 text-sm">{originals.length ? "All counters will be removed when you save." : "No counters yet. Choose Create new counter to add one."}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button className="rounded border border-canvas-line p-2 hover:bg-canvas-surface" onClick={requestClose} type="button">Cancel</button>
          <button className="rounded bg-canvas-ink p-2 text-canvas-on-ink hover:bg-canvas-ink/80" onClick={save} type="button">Save</button>
        </div>
      </StatusDialog>}
    {confirmClose ? <StatusDialog cancelOnBackdrop title="Unsaved counter changes" onClose={() => setConfirmClose(false)}>
      <p className="text-sm">Save your counter changes or discard them before closing?</p>
      {!valid ? <p className="mt-2 text-sm text-canvas-muted">Correct invalid counter values before saving.</p> : null}
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button className="rounded border border-canvas-line p-2 hover:bg-canvas-surface" onClick={() => setConfirmClose(false)} type="button">Keep editing</button>
        <button className="rounded border border-canvas-line p-2 hover:bg-canvas-surface" onClick={onClose} type="button">Discard changes</button>
        <button className="rounded bg-canvas-ink p-2 text-canvas-on-ink enabled:hover:bg-canvas-ink/80 disabled:cursor-not-allowed disabled:bg-canvas-surface disabled:text-canvas-muted disabled:opacity-40" disabled={!valid} onClick={save} type="button">Save changes</button>
      </div>
    </StatusDialog> : null}
  </>;
}
