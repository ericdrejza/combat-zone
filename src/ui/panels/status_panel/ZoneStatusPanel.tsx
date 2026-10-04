import { applyTagChanges } from "@core/entity_resources/tags";
import { useSelector } from "react-redux";
import { getAvailableCounterName } from "@core/entity_resources/counters";
import type { ClockCounter as Counter } from "@entities/zone/zoneStatus";
import { useInterfacePreferences } from "@ui/interface_preferences/InterfacePreferenceProvider";
import type { Zone } from "@entities/zone/types";
import { clockCounters, removeZoneClock, removeZoneCounter, saveZoneClock, saveZoneCounter, updateZoneStatus } from "@entities/zone/zoneStatus";
import type { RootState } from "@store/store";
import { NotesEditor } from "@ui/controls/NotesEditor";
import { TagEditor } from "@ui/controls/TagEditor";
import { usePersistence } from "@ui/persistence/PersistenceProvider";
import { useStatusActions } from "@ui/status/useStatusActions";
import { CounterControls } from "./CounterControls";

export function ZoneStatusPanel() {
  const selection = useSelector((state: RootState) => state.interaction.selection);
  const zones = useSelector((state: RootState) => state.encounter.present.zones);
  const ids = [...new Set(selection.selectedIds)];
  const zone = ids.length === 1 ? zones.byId[ids[0]] : undefined;
  const { clockStyleDefault } = useInterfacePreferences();
  const { readOnly } = usePersistence();
  const commit = useStatusActions();
  if (!zone) return <p className="p-4 text-sm text-canvas-muted">Select one zone to view status.</p>;
  function change(type: string, payload: Parameters<typeof commit>[1], mutate: (zone: Zone) => Zone) {
    void commit(`zone.${type}`, { zoneId: zone!.id, ...payload }, (state) => updateZoneStatus(state, zone!.id, mutate));
  }
  function save(counter: Counter, isClock: boolean, useDefaultName = false) {
    change(isClock ? "saveClock" : "saveCounter", { counter, useDefaultName }, (current) => {
      const name = useDefaultName ? getAvailableCounterName(isClock ? clockCounters(current.clocks) : current.counters, isClock ? "Clock" : "Counter") : counter.name;
      return isClock ? saveZoneClock(current, { id: counter.id, name, value: counter.value, segments: counter.maximum!, style: counter.style }) : saveZoneCounter(current, { ...counter, name });
    });
  }
  function adjust(id: string, amount: number, isClock: boolean) {
    change(isClock ? "adjustClock" : "adjustCounter", { resourceId: id, amount }, (current) => {
      const counter = current.counters?.byId[id];
      const clock = current.clocks?.byId[id];
      return isClock ? clock ? saveZoneClock(current, { ...clock, value: clock.value + amount }) : current : counter ? saveZoneCounter(current, { ...counter, value: counter.value + amount }) : current;
    });
  }
  function batch(counters: Counter[], removedIds: string[], isClock: boolean) {
    change(isClock ? "editClocks" : "editCounters", { counters, removedIds }, (current) => {
      const removed = removedIds.reduce((next, id) => isClock ? removeZoneClock(next, id) : removeZoneCounter(next, id), current);
      return counters.reduce((next, counter) => isClock ? saveZoneClock(next, { id: counter.id, name: counter.name, value: counter.value, segments: counter.maximum!, style: counter.style }) : saveZoneCounter(next, counter), removed);
    });
  }
  return <div aria-label="Zone status" className="space-y-4 py-2">
    <p aria-label="Selected zone name" className="break-words font-semibold">{zone.name}</p>
    <CounterControls key={`counters:${zone.id}`} counters={zone.counters} disabled={readOnly} onSave={(counter, useDefaultName) => save(counter, false, useDefaultName)} onAdjust={(id, amount) => adjust(id, amount, false)} onSaveBatch={(counters, removed) => batch(counters, removed, false)} />
    <CounterControls key={`clocks:${zone.id}`} kind="clock" defaultClockStyle={clockStyleDefault} counters={clockCounters(zone.clocks)} disabled={readOnly} onSave={(counter, useDefaultName) => save(counter, true, useDefaultName)} onAdjust={(id, amount) => adjust(id, amount, true)} onSaveBatch={(counters, removed) => batch(counters, removed, true)} />
    <TagEditor key={`tags:${zone.id}`} tags={zone.tags} disabled={readOnly} inputLabel="Add zone tag" tagsLabel="Zone tags" onChange={(tags) => change("setTags", { tags }, (current) => { const next = applyTagChanges(current.tags, zone.tags, tags); return next === current.tags ? current : { ...current, tags: next }; })} />
    <NotesEditor key={`notes:${zone.id}`} notes={zone.notes} disabled={readOnly} onChange={(notes) => change("setNotes", { notes }, (current) => (current.notes ?? "") === notes ? current : { ...current, notes })} />
  </div>;
}
