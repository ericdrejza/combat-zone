import { it, expect, vi } from "vitest";
import { diceEncounter } from "./fixtures";
import { playRollableAudio } from "@ui/dice/rollableAudio";
import { AUDIO_TRIGGER_EVENT } from "@ui/audio/audioTriggerEvents";
it("uses the linked Actor group's existing effect/shuffle selection once per launch", () => {
  const state = diceEncounter();
  state.audioCueGroups = { allIds: ["g"], byId: { g: { id: "g", name: "Attack", section: "actor", repeat: false, shuffleTriggers: true } } };
  state.audioCues = { allIds: ["one", "two"], byId: Object.fromEntries(["one", "two"].map(id => [id, { id, libraryNodeId: "asset", placement: { type: "group" as const, groupId: "g" }, type: "effect" as const, volume: 50, repeat: false, repeatDelay: { minimumDelaySeconds: 0, maximumDelaySeconds: 0 }, triggers: [], triggersEnabled: true }])) };
  const listener = vi.fn(); window.addEventListener(AUDIO_TRIGGER_EVENT, listener);
  try {
    playRollableAudio(state, "g", "invocation");
    expect(listener).toHaveBeenCalledOnce();
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toHaveLength(1);
    expect((listener.mock.calls[0][0] as CustomEvent).detail[0].instanceId).toBe("rollable:invocation");
    playRollableAudio(state, null, "ignored"); expect(listener).toHaveBeenCalledOnce();
  } finally { window.removeEventListener(AUDIO_TRIGGER_EVENT, listener); }
});
