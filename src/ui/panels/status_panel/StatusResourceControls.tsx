import { getAvailableCounterName } from "@core/entity_resources/counters";
import { clockCounters, removeResourceClock, removeResourceCounter, saveResourceClock, saveResourceCounter, type ClockCounter, type StatusResources } from "@core/entity_resources/statusResources";
import type { JsonObject } from "@core/history/types";
import { useInterfacePreferences } from "@ui/interface_preferences/InterfacePreferenceProvider";
import { CounterControls } from "./CounterControls";

/** Zone and encounter resources share drafts, bounds, naming, and batch commands. */
export function StatusResourceControls<T extends StatusResources>({ owner, disabled, onChange }: {
  owner: T; disabled: boolean;
  onChange: (type: string, payload: JsonObject, mutate: (owner: T) => T) => void;
}) {
  const { clockStyleDefault } = useInterfacePreferences();
  function save(current: T, counter: ClockCounter, isClock: boolean, useDefaultName = false): T {
    const name = useDefaultName ? getAvailableCounterName(isClock ? clockCounters(current.clocks) : current.counters, isClock ? "Clock" : "Counter") : counter.name;
    return isClock ? saveResourceClock(current, { id: counter.id, name, value: counter.value, segments: counter.maximum!, style: counter.style }) : saveResourceCounter(current, { ...counter, name });
  }
  return <>{[false, true].map((isClock) => <CounterControls key={isClock ? "clocks" : "counters"} kind={isClock ? "clock" : "counter"} defaultClockStyle={clockStyleDefault} counters={isClock ? clockCounters(owner.clocks) : owner.counters} disabled={disabled}
    onSave={(counter, useDefaultName = false) => onChange(isClock ? "saveClock" : "saveCounter", { counter, useDefaultName }, (current) => save(current, counter, isClock, useDefaultName))}
    onAdjust={(id, amount) => onChange(isClock ? "adjustClock" : "adjustCounter", { resourceId: id, amount }, (current) => {
      const resource = isClock ? current.clocks?.byId[id] : current.counters?.byId[id];
      if (!resource) return current;
      const counter = isClock ? clockCounters(current.clocks).byId[id] : current.counters!.byId[id];
      return save(current, { ...counter, value: counter.value + amount }, isClock);
    })}
    onSaveBatch={(counters, removedIds) => onChange(isClock ? "editClocks" : "editCounters", { counters, removedIds }, (current) => {
      const removed = removedIds.reduce((next, id) => isClock ? removeResourceClock(next, id) : removeResourceCounter(next, id), current);
      return counters.reduce((next, counter) => save(next, counter, isClock), removed);
    })} />)}</>;
}
