import type { EncounterState } from "@core/encounter/types";
import type { Actor } from "./types";
import { automaticStatus, validThresholds, normalizeCounter, normalizeHitPoints, type ActorCounter, type CombatRules, type HitPoints } from "./actorResources";

/** One immutable encounter replacement per bulk operation; untouched actors retain identity. */
export function updateSelectedActors(state: EncounterState, ids: string[], update: (actor: Actor) => Actor): EncounterState {
  const byId = { ...state.actors.byId };
  let changed = false;
  for (const id of new Set(ids)) {
    const actor = byId[id];
    if (!actor) continue;
    const next = update(actor);
    if (next !== actor) { byId[id] = next; changed = true; }
  }
  return changed ? { ...state, actors: { ...state.actors, byId } } : state;
}

export function setHitPoints(actor: Actor, input: HitPoints, rules: CombatRules, forceStatus = false): Actor {
  const hp = normalizeHitPoints(input, rules);
  const changed = hp.current !== actor.hitPoints?.current || hp.maximum !== actor.hitPoints?.maximum;
  const status = rules.automaticHealth && validThresholds(rules) && (changed || forceStatus) ? automaticStatus(hp, rules) : actor.status;
  if (!changed && status === actor.status) return actor;
  return { ...actor, hitPoints: hp, status };
}

export function adjustHitPoints(state: EncounterState, ids: string[], amount: number, rules: CombatRules): EncounterState {
  return updateSelectedActors(state, ids, (actor) => actor.hitPoints
    ? setHitPoints(actor, { ...actor.hitPoints, current: actor.hitPoints.current + amount }, rules) : actor);
}

export function applyCombatRules(state: EncounterState, rules: CombatRules): EncounterState {
  return updateSelectedActors(state, state.actors.allIds, (actor) => actor.hitPoints
    ? setHitPoints(actor, actor.hitPoints, rules, true) : actor);
}

/** Re-evaluate thresholds without changing HP merely because preferences changed. */
export function recalculateHealthStatuses(state: EncounterState, rules: CombatRules): EncounterState {
  if (!rules.automaticHealth || !validThresholds(rules)) return state;
  return updateSelectedActors(state, state.actors.allIds, (actor) => {
    if (!actor.hitPoints) return actor;
    const status = automaticStatus(actor.hitPoints, rules);
    return status === actor.status ? actor : { ...actor, status };
  });
}

export function toggleMarker(state: EncounterState, ids: string[], marker: string, exclusive: string[] = []): EncounterState {
  const actors = ids.map((id) => state.actors.byId[id]).filter(Boolean);
  const remove = actors.length > 0 && actors.every((actor) => actor.statusEffects.includes(marker));
  return updateSelectedActors(state, ids, (actor) => {
    if (!remove && actor.statusEffects.includes(marker) && !actor.statusEffects.some((value) => value !== marker && exclusive.includes(value))) return actor;
    const markers = actor.statusEffects.filter((value) => value !== marker && (remove || !exclusive.includes(value)));
    if (!remove) markers.push(marker);
    return markers.length === actor.statusEffects.length && markers.every((value, index) => value === actor.statusEffects[index])
      ? actor : { ...actor, statusEffects: markers };
  });
}

/** Removing a condition never toggles it back on if it was already removed. */
export function removeMarker(state: EncounterState, actorId: string, marker: string): EncounterState {
  return updateSelectedActors(state, [actorId], (actor) => actor.statusEffects.includes(marker)
    ? { ...actor, statusEffects: actor.statusEffects.filter((value) => value !== marker) } : actor);
}

export function saveCounter(actor: Actor, input: ActorCounter): Actor {
  const counter = normalizeCounter(input);
  const counters = actor.counters ?? { allIds: [], byId: {} };
  const previous = counters.byId[counter.id];
  if (previous && previous.name === counter.name && previous.value === counter.value && previous.minimum === counter.minimum && previous.maximum === counter.maximum) return actor;
  return { ...actor, counters: { allIds: previous ? counters.allIds : [...counters.allIds, counter.id], byId: { ...counters.byId, [counter.id]: counter } } };
}

export function removeCounter(actor: Actor, id: string): Actor {
  if (!actor.counters?.byId[id]) return actor;
  const byId = { ...actor.counters.byId };
  delete byId[id];
  return { ...actor, counters: { byId, allIds: actor.counters.allIds.filter((value) => value !== id) } };
}
