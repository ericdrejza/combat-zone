import type { EncounterState } from "@core/encounter/types";
import { emitAudioTriggers } from "@ui/audio/audioTriggerEvents";

/** Action launch is explicit; reuse the Actor group's shuffle selection and effect playback. */
export function playRollableAudio(state: EncounterState, groupId: string | null, invocationId: string) {
  const group = groupId ? state.audioCueGroups.byId[groupId] : null;
  if (!group || group.section !== "actor") return;
  const cues = state.audioCues.allIds.map(id => state.audioCues.byId[id]).filter(c => c.placement.groupId === group.id && c.type === "effect" && !c.repeat);
  const chosen = group.shuffleTriggers && cues.length ? [cues[Math.floor(Math.random() * cues.length)]] : cues;
  emitAudioTriggers(chosen.map(c => ({ explicit: true, cueId: c.id, instanceId: `rollable:${invocationId}` })));
}
