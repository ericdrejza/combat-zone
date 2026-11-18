import { Info } from "lucide-react";
import { openDiceNotation } from "@ui/settings/settingsNavigation";
import { TouchTooltip } from "@ui/toolbar/TouchTooltip";
import { useId, useState } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "@store/store";
import type { Actor } from "@entities/actor/types";
import type { Rollable } from "@core/dice/types";
import { saveRollables } from "@entities/actor/rollableMutations";
import { useStatusActions } from "@ui/status/useStatusActions";
import { usePersistence } from "@ui/persistence/PersistenceProvider";
import { ListEditDialog } from "@ui/controls/ListEditDialog";
import { configurableDraftChanges } from "@ui/controls/configurableDraftChanges";
import { validRollable } from "@combat-zone/firebase-api";
import { DICE_INPUT } from "./DiceIconButton";

function newRollable(): Rollable {
  return { id: crypto.randomUUID(), name: "", checkFormula: "", checkRollMode: "shared", effectFormula: "", effectKind: "damage", audioGroupId: null };
}

export function RollablesEditor({ actor, onClose, createOnOpen = false }: { actor: Actor; onClose: () => void; createOnOpen?: boolean }) {
  const formulaId = useId();
  const [originals] = useState(() => (actor.rollables?.allIds ?? []).map(id => ({ ...actor.rollables!.byId[id] })));
  const [entries, setEntries] = useState<Rollable[]>(() => [...(actor.rollables?.allIds ?? []).map(id => ({ ...actor.rollables!.byId[id] })), ...(createOnOpen ? [newRollable()] : [])]);
  const [selectedId, setSelectedId] = useState(createOnOpen ? entries.at(-1)?.id : entries[0]?.id);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const groups = useSelector((s: RootState) => s.encounter.present.audioCueGroups);
  const { readOnly } = usePersistence();
  const commit = useStatusActions();
  const selected = entries.find(r => r.id === selectedId);
  const valid = entries.every(validRollable);
  const dirtyIds = configurableDraftChanges(originals, entries);
  function create() {
    const rollable = newRollable();
    setEntries([...entries, rollable]);
    setSelectedId(rollable.id);
  }
  function update(patch: Partial<Rollable>) { setEntries(entries.map(r => r.id === selectedId ? { ...r, ...patch } : r)); }
  async function save() {
    setBusy(true); setError("");
    try {
      const saved = await commit("actor.editRollables", { actorId: actor.id, rollables: entries }, state => saveRollables(state, actor.id, entries));
      if (saved || JSON.stringify(entries) === JSON.stringify((actor.rollables?.allIds ?? []).map(id => actor.rollables!.byId[id]))) onClose();
    } catch (error) { setError(error instanceof Error ? error.message : "Could not save Rollables."); }
    finally { setBusy(false); }
  }
  return <ListEditDialog title={`Edit Rollables: ${actor.name}`} onClose={onClose} onSave={save}
    disabled={readOnly || busy} saveDisabled={!valid} cancelOnBackdrop dirtyCount={dirtyIds.size}
    onDelete={selected ? () => { const next = entries.filter(r => r.id !== selectedId); setEntries(next); setSelectedId(next[0]?.id); } : undefined}
    selection={{ label: "Rollable to edit", placeholder: "Select a Rollable", items: entries.map(r => ({ id: r.id, name: r.name || "Unnamed Rollable", dirty: dirtyIds.has(r.id) })),
      selectedId, onSelect: setSelectedId, onReorder: ids => setEntries(ids.map(id => entries.find(r => r.id === id)!)),
      createLabel: "Create new Rollable", onCreate: create }}>
    {selected ? <fieldset disabled={readOnly || busy} className="space-y-3">
      <label className="block text-sm">Name<input data-configurable-name data-dialog-initial-focus={createOnOpen || undefined} aria-label="Rollable name" required className={`${DICE_INPUT} mt-1 block`} value={selected.name} onChange={e => update({ name: e.target.value })} /></label>
      <div className="text-sm"><div className="flex items-center gap-1"><label htmlFor={`${formulaId}-check`}>Check roll (optional)</label><FormulaHelp formula="Check" /></div><input id={`${formulaId}-check`} aria-label="Check roll" placeholder="e.g. d20+5" className={`${DICE_INPUT} mt-1 block`} value={selected.checkFormula} onChange={e => update({ checkFormula: e.target.value })} /></div>
      <label className="block text-sm">Check roll mode<select aria-label="Check roll mode" className={`${DICE_INPUT} mt-1 block`} value={selected.checkRollMode} onChange={e => update({ checkRollMode: e.target.value as Rollable["checkRollMode"] })}><option value="shared">One check for all targets</option><option value="perTarget">One check per target</option><option value="ask">Ask me</option></select></label>
      <div className="text-sm"><div className="flex items-center gap-1"><label htmlFor={`${formulaId}-effect`}>Effect roll</label><FormulaHelp formula="Effect" /></div><input id={`${formulaId}-effect`} aria-label="Effect roll" placeholder="e.g. 2d6+4" required className={`${DICE_INPUT} mt-1 block`} value={selected.effectFormula} onChange={e => update({ effectFormula: e.target.value })} /></div>
      <label className="block text-sm">Effect kind<select aria-label="Effect kind" className={`${DICE_INPUT} mt-1 block`} value={selected.effectKind} onChange={e => update({ effectKind: e.target.value as Rollable["effectKind"] })}><option value="none">None</option><option value="damage">Damage</option><option value="healing">Healing</option></select></label>
      <label className="block text-sm">Sound group<select aria-label="Sound group" className={`${DICE_INPUT} mt-1 block`} value={selected.audioGroupId ?? ""} onChange={e => update({ audioGroupId: e.target.value || null })}><option value="">None</option>{groups.allIds.filter(id => groups.byId[id].section === "actor").map(id => <option key={id} value={id}>{groups.byId[id].name}</option>)}</select></label>
    </fieldset> : <p className="text-sm">No rollables yet. Choose Create new rollable to add one.</p>}
    {error ? <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
    {!valid ? <p className="mt-2 text-sm text-canvas-muted">Each Rollable needs a name and an effect roll.</p> : null}
  </ListEditDialog>;
}

function FormulaHelp({ formula }: { formula: string }) {
  return <TouchTooltip label="Click to open dice notation"><button type="button" aria-label={`${formula} roll notation help`} title="Click to open dice notation" onClick={openDiceNotation} className="rounded p-1 text-canvas-muted enabled:hover:bg-canvas-surface enabled:hover:text-canvas-ink focus-visible:ring-2 focus-visible:ring-canvas-ink disabled:cursor-not-allowed disabled:opacity-40"><Info aria-hidden="true" className="h-4 w-4" /></button></TouchTooltip>;
}
