import type { Middleware } from "@reduxjs/toolkit";

import type { EncounterState } from "@core/encounter/types";
import type { EncounterHistoryState } from "@core/history/types";
import type { AudioCueTrigger } from "@entities/audio/types";
import type { InteractionState } from "@interaction/interactionState";
import { emitAudioTriggers, type AudioTriggerRequest } from "@ui/audio/audioTriggerEvents";
import { commitEncounterChange } from "./encounterSlice";

type AudioTriggerState = { encounter: EncounterHistoryState; interaction: InteractionState };
let triggerSequence = 0;

function request(cueId: string, sourceId: string): AudioTriggerRequest {
  triggerSequence += 1;
  return { cueId, instanceId: `${sourceId}-${triggerSequence}` };
}

function requestsForTrigger(state: EncounterState, actorId: string, zoneId: string, trigger: AudioCueTrigger): AudioTriggerRequest[] {
  return state.audioCues.allIds.flatMap((cueId) => {
    const cue = state.audioCues.byId[cueId];
    if (cue.type !== "effect" || !cue.triggersEnabled || !cue.triggers.includes(trigger)) return [];
    const group = state.audioCueGroups.byId[cue.placement.groupId];
    const inherited = group?.section === "zone"
      ? (state.zones.byId[zoneId]?.audioGroupIds ?? []).includes(group.id)
      : group?.section === "actor"
        ? (state.actors.byId[actorId]?.audioGroupIds ?? []).includes(group.id)
        : false;
    return inherited ? [request(cueId, `${actorId}-${zoneId}-${trigger}`)] : [];
  });
}

/** Emits movement triggers in leave-zone/leave-actor/enter-zone/enter-actor order. */
function movementRequests(before: EncounterState, after: EncounterState): AudioTriggerRequest[] {
  const movements = after.actors.allIds.flatMap((actorId) => {
    const previous = before.actors.byId[actorId]?.currentZoneId;
    const current = after.actors.byId[actorId]?.currentZoneId;
    return previous !== current ? [{ actorId, current, previous }] : [];
  });
  const real = (zoneId: string | null | undefined): zoneId is string => Boolean(zoneId && zoneId !== "zoneless");
  return [
    ...movements.flatMap(({ actorId, previous }) => real(previous) ? requestsForTrigger(after, actorId, previous, "zone_leave") : []),
    ...movements.flatMap(({ actorId, previous }) => real(previous) ? requestsForTrigger(after, actorId, previous, "actor_leave_zone") : []),
    ...movements.flatMap(({ actorId, current }) => real(current) ? requestsForTrigger(after, actorId, current, "zone_enter") : []),
    ...movements.flatMap(({ actorId, current }) => real(current) ? requestsForTrigger(after, actorId, current, "actor_enter_zone") : [])
  ];
}

export const audioTriggerMiddleware: Middleware<unknown, AudioTriggerState> = (api) => (next) => (action) => {
  const before = api.getState();
  const result = next(action);
  const after = api.getState();
  if (commitEncounterChange.match(action)) emitAudioTriggers(movementRequests(before.encounter.present, after.encounter.present));
  return result;
};
