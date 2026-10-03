import { Flag, Repeat1 } from "lucide-react";

import type { AudioCue } from "@entities/audio/types";

type Props = {
  cue: AudioCue;
  name: string;
  showTriggers: boolean;
  onCommit: (update: Partial<Pick<AudioCue, "repeat" | "triggersEnabled">>, actionType: string) => void;
};

/** Toggle buttons permit one active behavior or neither, without clearing settings. */
export function CueBehaviorButtons({ cue, name, showTriggers, onCommit }: Props) {
  const choices = [
    { Icon: Repeat1, label: "repeat", active: cue.repeat, onClick: () => onCommit({ repeat: !cue.repeat }, "audio.setRepeat") },
    ...(showTriggers ? [{ Icon: Flag, label: "triggers", active: cue.triggersEnabled, onClick: () => onCommit({ triggersEnabled: !cue.triggersEnabled }, "audio.setTriggersEnabled") }] : [])
  ];
  return <div aria-label={`Behavior for ${name}`} className="flex gap-1" role="group">{choices.map(({ Icon, label, active, onClick }) => <button aria-label={`${active ? "Disable" : "Enable"} ${label}`} aria-pressed={active} className={`flex h-7 w-7 items-center justify-center rounded-lg border ${active ? "border-canvas-ink bg-canvas-ink text-canvas-on-ink" : "border-canvas-line text-canvas-muted"}`} key={label} onClick={onClick} title={label === "repeat" ? "Repeat" : "Triggers"} type="button"><Icon aria-hidden="true" className="h-3.5 w-3.5" /></button>)}</div>;
}
