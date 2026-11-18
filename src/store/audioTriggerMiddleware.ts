import type { Middleware } from "@reduxjs/toolkit";

import type { EncounterState } from "@core/encounter/types";
import type { EncounterActionRecord, EncounterHistoryState } from "@core/history/types";
import { getActorStatus } from "@entities/actor/actorStatus";
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
  const pools = new Map<string, string[]>();
  for (const cueId of state.audioCues.allIds) {
    const cue = state.audioCues.byId[cueId];
    if (cue.type !== "effect" || cue.repeat || !cue.triggersEnabled || !cue.triggers.includes(trigger)) continue;
    const group = state.audioCueGroups.byId[cue.placement.groupId];
    const inherited = group?.section === "zone"
      ? (state.zones.byId[zoneId]?.audioGroupIds ?? []).includes(group.id)
      : group?.section === "actor"
        ? (state.actors.byId[actorId]?.audioGroupIds ?? []).includes(group.id)
        : false;
    if (inherited) {
      const pool = pools.get(group.id) ?? [];
      pool.push(cueId);
      pools.set(group.id, pool);
    }
  }
  // Each occurrence samples independently; playback deduplicates shared selections.
  return [...pools].flatMap(([groupId, pool]) => {
    const selected = state.audioCueGroups.byId[groupId].shuffleTriggers
      ? [pool[Math.floor(Math.random() * pool.length)]] : pool;
    return selected.map((cueId) => request(cueId, `${actorId}-${zoneId}-${trigger}`));
  });
}

/** Zone boundaries track membership; Moves tracks committed, deliberate actor movement. */
function movementRequests(before: EncounterState, after: EncounterState, action: EncounterActionRecord): AudioTriggerRequest[] {
  const movements = after.actors.allIds.flatMap((actorId) => {
    const previous = before.actors.byId[actorId]?.currentZoneId;
    const current = after.actors.byId[actorId]?.currentZoneId;
    return previous !== current ? [{ actorId, current, previous }] : [];
  });
  const deliberate = ["actor.move", "actor.moveMany", "actor.moveSpatial", "engagement.join", "engagement.create"].includes(action.type);
  const actorMovements = deliberate ? after.actors.allIds.filter((actorId) => {
    const previous = before.actors.byId[actorId];
    const current = after.actors.byId[actorId];
    if (!previous) return false;
    const changedPosition = action.type === "actor.moveSpatial" && !after.movementRules.zoneLocked &&
      (previous.spatialPosition?.x !== current.spatialPosition?.x || previous.spatialPosition?.y !== current.spatialPosition?.y);
    return previous.currentZoneId !== current.currentZoneId || changedPosition;
  }) : [];
  const real = (zoneId: string | null | undefined): zoneId is string => Boolean(zoneId && zoneId !== "zoneless");
  return [
    ...movements.flatMap(({ actorId, previous }) => real(previous) ? requestsForTrigger(after, actorId, previous, "zone_leave") : []),
    ...movements.flatMap(({ actorId, current }) => real(current) ? requestsForTrigger(after, actorId, current, "zone_enter") : []),
    ...actorMovements.flatMap((actorId) => requestsForTrigger(after, actorId, after.actors.byId[actorId].currentZoneId, "actor_changes_zone"))
  ];
}

/** Compare committed values so rejected commands, direct HP edits, and history replay stay silent for damage. */
function healthRequests(before: EncounterState, after: EncounterState, action: EncounterActionRecord): AudioTriggerRequest[] {
  const damage = action.type === "actor.adjustHitPoints" && typeof action.payload.amount === "number" && action.payload.amount < 0;
  const applications = action.type === "actor.adjustRollHitPoints" && Array.isArray(action.payload.applications) ? action.payload.applications : [];
  const damagedIds = damage && Array.isArray(action.payload.actorIds) ? action.payload.actorIds : applications.flatMap(item => item && typeof item === "object" && !Array.isArray(item) && item.kind === "damage" && typeof item.actorId === "string" ? [item.actorId] : []);
  const healthTriggers = ["actor_health_dead", "actor_health_unconscious", "actor_health_injured", "actor_health_healthy"] as const;
  return after.actors.allIds.flatMap((actorId) => {
    const previous = before.actors.byId[actorId];
    const current = after.actors.byId[actorId];
    if (!previous) return [];
    const requests: AudioTriggerRequest[] = [];
    if (damagedIds.includes(actorId) && previous.hitPoints && current.hitPoints && current.hitPoints.current < previous.hitPoints.current) {
      requests.push(...requestsForTrigger(after, actorId, current.currentZoneId, "actor_takes_damage"));
    }
    const status = getActorStatus(current);
    if (status !== getActorStatus(previous)) {
      requests.push(...requestsForTrigger(after, actorId, current.currentZoneId, healthTriggers[status]));
    }
    return requests;
  });
}

export const audioTriggerMiddleware: Middleware<unknown, AudioTriggerState> = (api) => (next) => (action) => {
  const before = api.getState();
  const result = next(action);
  const after = api.getState();
  if (commitEncounterChange.match(action) && before.encounter.present !== after.encounter.present) {
    emitAudioTriggers([...movementRequests(before.encounter.present, after.encounter.present, action.payload.action), ...healthRequests(before.encounter.present, after.encounter.present, action.payload.action)]);
  }
  return result;
};
