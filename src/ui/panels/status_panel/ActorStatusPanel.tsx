import { getAvailableCounterName } from "@entities/actor/counterNames";
import { useSelector } from "react-redux";
import type { RootState } from "@store/store";
import { updateActorStatus } from "@entities/actor/actorStatus";
import { adjustHitPoints, removeCounter, saveCounter, setHitPoints, toggleMarker, updateSelectedActors } from "@entities/actor/statusMutations";
import { useCombatPreferences } from "@ui/combat_preferences/CombatPreferenceProvider";
import { useInterfacePreferences } from "@ui/interface_preferences/InterfacePreferenceProvider";
import { usePersistence } from "@ui/persistence/PersistenceProvider";
import { ARMOR, CONDITIONS, CONDITION_GROUPS, WEAPONS } from "@ui/status/markerCatalog";
import { useStatusActions } from "@ui/status/useStatusActions";
import { HealthStatusControl } from "./HealthStatusControl";
import { MarkerSection } from "./MarkerSection";
import { CounterControls } from "./CounterControls";
import { HitPointControls } from "./HitPointControls";

/** Frequently updated actor details, with bulk commands committed as one history entry. */
export function ActorStatusPanel() {
  const selection = useSelector((state: RootState) => state.interaction.selection);
  const encounter = useSelector((state: RootState) => state.encounter.present);
  const { readOnly } = usePersistence();
  const { rules, visibility } = useCombatPreferences();
  const { healthCounterName } = useInterfacePreferences();
  const commit = useStatusActions();
  const actors = selection.selectedEntityType === "actor" ? Array.from(new Set(selection.selectedIds)).map((id) => encounter.actors.byId[id]).filter(Boolean) : [];
  const ids = actors.map((actor) => actor.id);
  const visibleConditions = CONDITIONS.filter(({ id }) => (visibility.showConditions && !visibility.hiddenConditions.includes(id)) || actors.some((actor) => actor.statusEffects.includes(id)));
  const actor = actors.length === 1 ? actors[0] : undefined;
  if (!actors.length) return <p className="p-4 text-sm text-canvas-muted">Select an actor to view status.</p>;
  return <div aria-label="Actor status" className="space-y-4 py-2">
    <div aria-label="Selected actor names" className="space-y-1">{actors.map((actor) => <p className="break-words font-semibold" key={actor.id}>{actor.name}</p>)}</div>
    {actor ? <HealthStatusControl actor={actor} disabled={readOnly} onChange={(status) => void commit("actor.setStatus", { actorId: actor.id, status }, (state) => updateActorStatus(state, actor.id, status))} /> : null}
    <HitPointControls key={`hp:${ids.join("|")}`} actors={actors} disabled={readOnly} label={healthCounterName}
      onAdjust={(actorIds, amount) => void commit("actor.adjustHitPoints", { actorIds, amount, rules }, (state) => adjustHitPoints(state, actorIds, amount, rules))}
      onSet={(id, hp) => void commit("actor.setHitPoints", { actorId: id, hitPoints: hp, rules }, (state) => updateSelectedActors(state, [id], (actor) => setHitPoints(actor, hp, rules)))} />
    {actor ? <CounterControls key={`counters:${actor.id}`} counters={actor.counters} disabled={readOnly}
      onSave={(counter, useDefaultName = false) => void commit("actor.saveCounter", { actorId: actor.id, counter, useDefaultName }, (state) => updateSelectedActors(state, [actor.id], (current) => saveCounter(current, useDefaultName ? { ...counter, name: getAvailableCounterName(current.counters) } : counter)))}
      onAdjust={(id, amount) => void commit("actor.adjustCounter", { actorId: actor.id, counterId: id, amount }, (state) => updateSelectedActors(state, [actor.id], (current) => {
        const counter = current.counters?.byId[id];
        return counter ? saveCounter(current, { ...counter, value: counter.value + amount }) : current;
      }))}
      onSaveBatch={(counters, removedIds) => void commit("actor.editCounters", { actorId: actor.id, counters, removedIds }, (state) => updateSelectedActors(state, [actor.id], (current) => {
        const removed = removedIds.reduce((next, id) => removeCounter(next, id), current);
        return counters.reduce((next, counter) => saveCounter(next, counter), removed);
      }))} /> : null}
    {visibleConditions.length ? <MarkerSection title="Conditions" actors={actors} markers={visibleConditions} subsections={CONDITION_GROUPS.map((group) => ({ ...group, markers: group.markers.filter((marker) => visibleConditions.includes(marker)) }))} disabled={readOnly} onToggle={(marker) => void commit("actor.toggleCondition", { actorIds: ids, marker }, (state) => toggleMarker(state, ids, marker))} /> : null}
    {visibility.showWeapons ? <MarkerSection title="Weapons" actors={actors} markers={WEAPONS} disabled={readOnly} onToggle={(marker) => void commit("actor.toggleWeapon", { actorIds: ids, marker }, (state) => toggleMarker(state, ids, marker))} /> : null}
    {visibility.showArmor ? <MarkerSection title="Armor" actors={actors} markers={ARMOR} disabled={readOnly} onToggle={(marker) => void commit("actor.toggleArmor", { actorIds: ids, marker }, (state) => toggleMarker(state, ids, marker, ARMOR.map(({ id }) => id)))} /> : null}
  </div>;
}
