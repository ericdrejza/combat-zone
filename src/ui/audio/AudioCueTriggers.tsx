import { HeartMinus, MoveLeft, MoveRight, Waypoints } from "lucide-react";

import type { AudioCue, AudioCueTrigger } from "@entities/audio/types";
import type { updateAudioCue } from "@entities/audio/audioMutations";
import { HEALTH_STATUSES } from "@ui/status/healthCatalog";

const healthTriggers = ["actor_health_dead", "actor_health_unconscious", "actor_health_injured"] as const;
const healthChoices = HEALTH_STATUSES.filter(({ value }) => value < 3).map(({ value, label, Icon }) => ({
  Icon, label, trigger: healthTriggers[value as 0 | 1 | 2]
}));

function getTriggerChoices(owner: "zone" | "actor"): Array<{ Icon: typeof MoveLeft; label: string; trigger: AudioCueTrigger }> {
  return owner === "zone"
    ? [{ Icon: MoveLeft, label: "Entering zone", trigger: "zone_enter" }, { Icon: MoveRight, label: "Leaving zone", trigger: "zone_leave" }]
    : [{ Icon: Waypoints, label: "Changes zones", trigger: "actor_changes_zone" }, { Icon: HeartMinus, label: "Takes damage", trigger: "actor_takes_damage" }];
}

export function TriggerIndicators({ cue, owner }: { cue: AudioCue; owner?: "zone" | "actor" }) {
  if (!owner || cue.type !== "effect" || !cue.triggersEnabled) return null;
  const choices = [...getTriggerChoices(owner), ...(owner === "actor" ? healthChoices : [])];
  return <>{choices.filter(({ trigger }) => cue.triggers.includes(trigger)).map(({ Icon, label, trigger }) => <span aria-label={label} className="inline-flex shrink-0" key={trigger} role="img" title={label}><Icon aria-hidden="true" className="h-3.5 w-3.5" /></span>)}</>;
}

export function TriggerChoices({ cue, onCommit, owner }: { cue: AudioCue; onCommit: (update: Parameters<typeof updateAudioCue>[2], actionType?: string) => void; owner: "zone" | "actor" }) {
  function toggle(trigger: AudioCueTrigger) {
    onCommit({ triggers: cue.triggers.includes(trigger) ? cue.triggers.filter((value) => value !== trigger) : [...cue.triggers, trigger] }, "audio.setTriggers");
  }
  return <fieldset><legend className="mb-1 text-canvas-muted">Triggers</legend>
    <div className="grid grid-cols-2 gap-1">{getTriggerChoices(owner).map(({ label, trigger }) => <label className="flex min-w-0 cursor-pointer items-center gap-1 rounded-lg bg-canvas px-1.5 py-1 hover:bg-canvas-panel focus-within:ring-2 focus-within:ring-canvas-ink" key={trigger}><input checked={cue.triggers.includes(trigger)} onChange={() => toggle(trigger)} type="checkbox" /><span>{label}</span></label>)}</div>
    {owner === "actor" ? <div className="mt-1 flex flex-wrap items-center gap-1 rounded-lg bg-canvas px-1.5 py-1"><span>Health status becomes</span><div className="flex shrink-0 items-center gap-1">{healthChoices.map(({ Icon, label, trigger }) => <button aria-label={label} aria-pressed={cue.triggers.includes(trigger)} className={`flex h-7 w-7 items-center justify-center rounded-lg border hover:ring-2 hover:ring-canvas-ink focus-visible:ring-2 focus-visible:ring-canvas-ink ${cue.triggers.includes(trigger) ? "border-canvas-ink bg-canvas-ink text-canvas-on-ink" : "border-canvas-line text-canvas-muted"}`} key={trigger} onClick={() => toggle(trigger)} title={label} type="button"><Icon aria-hidden="true" className="h-4 w-4" /></button>)}</div></div> : null}
  </fieldset>;
}
