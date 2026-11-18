import { ListEditDialog } from "@ui/controls/ListEditDialog";
import type { OrderedEditorSelectProps } from "@ui/controls/OrderedEditorSelect";
import { unmapCounterBars, type ResourceBars } from "@entities/actor/resourceBars";
import { getAvailableCounterName } from "@core/entity_resources/counters";
import { useState } from "react";
import type { ClockCounter as Counter } from "@core/entity_resources/statusResources";
import { DEFAULT_CLOCK_STYLE, type ClockStyle } from "@core/entity_resources/clockStyle";
import { CounterEditor, createCounterDraft, isCounterDraftValid, resolveCounterDraft, type CounterDraft } from "./CounterEditor";
import { configurableDraftChanges } from "@ui/controls/configurableDraftChanges";

function newCounter(counters: Counter[], kind: "counter" | "clock", style: ClockStyle): Counter {
  const name = getAvailableCounterName({ allIds: counters.map(c => c.id), byId: Object.fromEntries(counters.map(c => [c.id, c])) }, kind === "clock" ? "Clock" : "Counter");
  return { id: crypto.randomUUID(), name, value: 0, ...(kind === "clock" ? { minimum: 0, maximum: 4, style } : {}) };
}

/** All counter edits stay local until one save commits the complete draft. */
export function CounterBatchEditor({ counters, kind = "counter", defaultClockStyle = DEFAULT_CLOCK_STYLE, initialSelectedId, createOnOpen = false, onClose, onSave, resourceBars }: {
  counters: Counter[];
  resourceBars?: ResourceBars;
  initialSelectedId?: string;
  createOnOpen?: boolean;
  kind?: "counter" | "clock";
  defaultClockStyle?: ClockStyle;
  onClose: () => void;
  onSave: (counters: Counter[], removedIds: string[], resourceBars?: ResourceBars, orderIds?: string[], automaticNameIds?: string[]) => void;
}) {
  const [barMapping, setBarMapping] = useState(resourceBars);
  const plural = kind === "clock" ? "clocks" : "counters";
  const prefix = kind === "clock" ? "Clock" : "Counter";
  const [originals] = useState(() => counters);
  const [entries, setEntries] = useState(() => [...counters, ...(createOnOpen ? [newCounter(counters, kind, defaultClockStyle)] : [])]);
  const [drafts, setDrafts] = useState<Record<string, CounterDraft>>(() => Object.fromEntries(entries.map(counter => [counter.id, { ...createCounterDraft(counter), name: counters.some(c => c.id === counter.id) ? counter.name : "" }])));
  const [selectedId, setSelectedId] = useState(() => createOnOpen ? entries.at(-1)?.id ?? "" : counters.find((counter) => counter.id === initialSelectedId)?.id ?? counters[0]?.id ?? "");
  const remaining = entries.filter((counter) => drafts[counter.id]);
  const isNew = (id: string) => !originals.some((counter) => counter.id === id);
  const mappedSlots = (mapping: ResourceBars | undefined, id: string) => [mapping?.first, mapping?.second]
    .map((source) => source?.kind === "counter" && source.counterId === id);
  const changed = entries.filter((counter) => JSON.stringify(mappedSlots(barMapping, counter.id)) !== JSON.stringify(mappedSlots(resourceBars, counter.id)) || (isNew(counter.id) ? !!drafts[counter.id] : JSON.stringify(drafts[counter.id]) !== JSON.stringify(createCounterDraft(counter))));
  const valid = remaining.every((counter) => isCounterDraftValid(drafts[counter.id], isNew(counter.id) ? counter.name : "", kind));
  const selected = entries.find((counter) => counter.id === selectedId);
  const dirtyIds = configurableDraftChanges(
    originals.map(counter => ({ id: counter.id, draft: createCounterDraft(counter), slots: mappedSlots(resourceBars, counter.id) })),
    remaining.map(counter => ({ id: counter.id, draft: drafts[counter.id], slots: mappedSlots(barMapping, counter.id) }))
  );
  const orderChanged = remaining.map(e => e.id).join("|") !== originals.map(e => e.id).join("|");
  function createCounter() {
    const counter = newCounter(remaining.map(c => ({ ...c, name: drafts[c.id].name.trim() || c.name })), kind, defaultClockStyle);
    setEntries([...entries, counter]);
    setDrafts({ ...drafts, [counter.id]: { ...createCounterDraft(counter), name: "" } });
    setSelectedId(counter.id);
  }
  function save() {
    if (!valid) return;
    const resolved = remaining.map((counter) => resolveCounterDraft(counter.id, drafts[counter.id]));
    const automaticNameIds = resolved.filter(counter => !counter.name).map(counter => counter.id);
    // Reserve explicit names first, so automatic names never conflict with this draft.
    const named = { allIds: resolved.filter((counter) => counter.name).map(({ id }) => id), byId: Object.fromEntries(resolved.filter((counter) => counter.name).map((counter) => [counter.id, counter])) };
    for (const counter of resolved) {
      if (!counter.name) {
        counter.name = getAvailableCounterName(named, prefix);
        named.allIds.push(counter.id);
        named.byId[counter.id] = counter;
      }
    }
    const saved = resolved.filter((counter) => changed.some((entry) => entry.id === counter.id));
    const removed = originals.filter((counter) => !drafts[counter.id]).map((counter) => counter.id);
    onSave(saved, removed, barMapping, orderChanged ? remaining.map(e => e.id) : undefined, automaticNameIds);
  }
  function removeSelected() {
    const next = { ...drafts };
    delete next[selectedId];
    setDrafts(next);
    if (barMapping) setBarMapping(unmapCounterBars(barMapping, selectedId));
    setSelectedId(remaining.find((counter) => counter.id !== selectedId)?.id ?? "");
  }
  const selection: OrderedEditorSelectProps = {
    label: `${prefix} to edit`, placeholder: `Select a ${kind}`, selectedId,
    items: remaining.map(counter => ({ id: counter.id, name: drafts[counter.id].name || counter.name, dirty: dirtyIds.has(counter.id) })),
    onSelect: setSelectedId, onReorder: ids => setEntries(ids.map(id => entries.find(entry => entry.id === id)!)),
    createLabel: `Create new ${kind}`, onCreate: createCounter
  };
  return <>
    {selected && drafts[selectedId] ? <CounterEditor resourceCounterId={selectedId} barMapping={barMapping ? { value: barMapping, counterNames: Object.fromEntries(remaining.map((counter) => [counter.id, drafts[counter.id].name.trim() || counter.name])), onChange: setBarMapping } : undefined} kind={kind} defaultClockStyle={defaultClockStyle} title={`Edit ${plural}`} counter={isNew(selectedId) ? undefined : selected} defaultName={selected.name} draft={drafts[selectedId]}
      onDraftChange={(draft) => setDrafts({ ...drafts, [selectedId]: draft })} onClose={onClose} dirtyCount={dirtyIds.size} onSave={save} saveDisabled={!valid}
      onRemove={removeSelected} selection={selection} /> : <ListEditDialog title={`Edit ${plural}`} onClose={onClose} dirtyCount={dirtyIds.size} onSave={save} selection={selection}>
        <p className="text-sm">{originals.length ? `All ${plural} will be removed when you save.` : `No ${plural} yet. Choose Create new ${kind} to add one.`}</p>
      </ListEditDialog>}
  </>;
}
