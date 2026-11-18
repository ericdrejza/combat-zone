import { createEncounterState } from "@core/encounter/createEncounterState";
import { createActor } from "@entities/actor/actorMutations";
import { createZone } from "@entities/zone/zoneMutations";
import type { Rollable } from "@core/dice/types";
export const slash: Rollable = { id: "slash", name: "Slash", checkFormula: "d20+5", checkRollMode: "shared", effectFormula: "2d6+3", effectKind: "damage", audioGroupId: null };
export function diceEncounter() {
  let state = createEncounterState({ id: "dice", name: "Dice" });
  for (const [id, name] of [["a", "Goblin Chief"], ["b", "Guard"], ["c", "Scout"]]) {
    state = createActor(state, { id, currentZoneId: "zoneless", name });
    state.actors.byId[id].hitPoints = { current: 20, maximum: 30 };
  }
  state.actors.byId.a.rollables = { allIds: [slash.id], byId: { [slash.id]: { ...slash } } };
  return state;
}

export function scopedReferenceEncounter() {
  let state = createZone(diceEncounter(), { id: "z1", name: "Zone1", polygon: [], colorFill: "#123456" });
  state = createZone(state, { id: "z2", name: "Zone2", polygon: [] });
  state.actors.byId.a.currentZoneId = "z1"; state.actors.byId.a.layoutGroup = "hero";
  state.actors.byId.b.currentZoneId = "z1"; state.actors.byId.b.layoutGroup = "enemy";
  state.actors.byId.c.currentZoneId = "z2"; state.actors.byId.c.layoutGroup = "hero";
  state = createActor(state, { id: "d", name: "Hero Two", currentZoneId: "z1" });
  state.actors.byId.d.layoutGroup = "hero";
  return state;
}
