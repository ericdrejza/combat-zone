import { previewedName } from '@interaction/namePreviewState';
import { actorResourceBars, setResourceBars } from "@entities/actor/resourceBars";
import { getAvailableCounterName } from "@entities/actor/counterNames";
import { abbreviateDistanceUnit } from "@core/measurement/distanceUnits";
import { updateActorProperties } from "@entities/actor/actorMutations";
import { useSelector } from "react-redux";
import type { RootState } from "@store/store";
import { updateActorStatus } from "@entities/actor/actorStatus";
import { adjustHitPoints, removeCounter, saveCounter, setHitPoints, toggleMarker, updateSelectedActors } from "@entities/actor/statusMutations";
import { useCombatPreferences } from "@ui/combat_preferences/CombatPreferenceProvider";
import { useInterfacePreferences } from "@ui/interface_preferences/InterfacePreferenceProvider";
import { usePersistence } from "@ui/persistence/PersistenceProvider";
import { ARMOR, CONDITIONS, CONDITION_GROUPS, SHIELD, WEAPONS } from "@ui/status/markerCatalog";
import { useStatusActions } from "@ui/status/useStatusActions";
import { HealthStatusControl } from "./HealthStatusControl";
import { MarkerSection } from "./MarkerSection";
import { CounterControls } from "./CounterControls";
import { HitPointControls } from "./HitPointControls";
import { ActorMovementLimit } from "./ActorMovementLimit";
import { useStatusDashboard } from "./StatusDashboardContext";
import { ActorStatusName } from "./ActorStatusName";
import { ActorStatusHealthRow } from "./ActorStatusHealthRow";

/** Frequently updated actor details, with bulk commands committed as one history entry. */
export function ActorStatusPanel() {
  const namePreview = useSelector((state: RootState) => state.interaction.namePreview);
  const dashboard = useStatusDashboard();
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
  const displayName = (actor: (typeof actors)[number]) => previewedName(namePreview, encounter.id, 'actor', actor.id, actor.name);
  return <div aria-label="Actor status" className="space-y-4 py-2">
    <ActorStatusHealthRow actor={actor} displayName={actor ? displayName(actor) : undefined} names={
      <div aria-label="Selected actor names" className="space-y-1">{actors.map((actor) => <ActorStatusName actor={actor} displayName={displayName(actor)} key={actor.id} largeImage={actors.length === 1} showImage={!dashboard || actors.length > 1} />)}</div>
    }>
    {actor ? <HealthStatusControl actor={actor} disabled={readOnly} onChange={(status) => void commit("actor.setStatus", { actorId: actor.id, status }, (state) => updateActorStatus(state, actor.id, status))} /> : null}
    <HitPointControls key={`hp:${ids.join("|")}`} actors={actors} disabled={readOnly} label={healthCounterName}
      onAdjust={(actorIds, amount) => void commit("actor.adjustHitPoints", { actorIds, amount, rules }, (state) => adjustHitPoints(state, actorIds, amount, rules))}
      onSet={(id, hp, mapping) => void commit("actor.setHitPoints", { actorId: id, hitPoints: hp, rules, mapping: mapping ?? null }, (state) => updateSelectedActors(state, [id], (actor) => setResourceBars(setHitPoints(actor, hp, rules), mapping ?? actorResourceBars(actor))))} />
    </ActorStatusHealthRow>
    {actor ? <CounterControls key={`counters:${actor.id}`} counters={actor.counters} resourceBars={actorResourceBars(actor)} disabled={readOnly}
      onSave={(counter, useDefaultName = false, mapping) => void commit("actor.saveCounter", { actorId: actor.id, counter, useDefaultName, mapping: mapping ?? null }, (state) => updateSelectedActors(state, [actor.id], (current) => setResourceBars(saveCounter(current, useDefaultName ? { ...counter, name: getAvailableCounterName(current.counters) } : counter), mapping ?? actorResourceBars(current))))}
      onAdjust={(id, amount) => void commit("actor.adjustCounter", { actorId: actor.id, counterId: id, amount }, (state) => updateSelectedActors(state, [actor.id], (current) => {
        const counter = current.counters?.byId[id];
        return counter ? saveCounter(current, { ...counter, value: counter.value + amount }) : current;
      }))}
      onSaveBatch={(counters, removedIds, mapping) => void commit("actor.editCounters", { actorId: actor.id, counters, removedIds, mapping: mapping ?? null }, (state) => updateSelectedActors(state, [actor.id], (current) => {
        const removed = removedIds.reduce((next, id) => removeCounter(next, id), current);
        return setResourceBars(counters.reduce((next, counter) => saveCounter(next, counter), removed), mapping ?? actorResourceBars(current));
      }))} /> : null}
    {visibleConditions.length ? <MarkerSection title="Conditions" collapsible actors={actors} markers={visibleConditions} subsections={CONDITION_GROUPS.map((group) => ({ ...group, markers: group.markers.filter((marker) => visibleConditions.includes(marker)) }))} disabled={readOnly} onToggle={(marker) => void commit("actor.toggleCondition", { actorIds: ids, marker }, (state) => toggleMarker(state, ids, marker))} /> : null}
    <div className={dashboard ? "flex flex-wrap items-start gap-x-6 gap-y-4" : "space-y-4"}>
    {visibility.showWeapons ? <MarkerSection title="Weapons" actors={actors} markers={WEAPONS} disabled={readOnly} onToggle={(marker) => void commit("actor.toggleWeapon", { actorIds: ids, marker }, (state) => toggleMarker(state, ids, marker))} /> : null}
    {visibility.showArmor ? <MarkerSection title="Armor" dividerBefore={SHIELD.id} actors={actors} markers={[...ARMOR, SHIELD]} disabled={readOnly} onToggle={(marker) => void commit("actor.toggleArmor", { actorIds: ids, marker }, (state) => toggleMarker(state, ids, marker, marker === SHIELD.id ? [] : ARMOR.map(({ id }) => id)))} /> : null}
    <div className={dashboard ? "w-fit max-w-full" : undefined}>
    {actor ? <ActorMovementLimit actor={actor} unit={abbreviateDistanceUnit(encounter.grid.distanceUnit ?? "feet")} step={encounter.grid.distancePerCell ?? 5}
      onChange={(movementLimit) => void commit("actor.updateProperties", { actorId: actor.id, properties: { movementLimit } }, (state) => updateActorProperties(state, actor.id, { movementLimit }))} /> : null}
    </div>
    </div>
  </div>;
}
