import { CircleCheck, CircleHelp, CircleX } from "lucide-react";
import { useState } from "react";
import type { Actor } from "@entities/actor/types";
import { StatusDialog } from "@ui/panels/status_panel/StatusDialog";
import { ActorVisual } from "./ActorVisual";

const button = "rounded-xl border border-canvas-line px-3 py-2 text-sm enabled:hover:bg-canvas-surface focus-visible:ring-2 focus-visible:ring-canvas-ink disabled:cursor-not-allowed disabled:opacity-40";

/** Adjudication records intent only; the parent commits the complete movement batch. */
export function ActorSkillCheckDialog({ actors, routes, onClose, onProceed }: {
  actors: Actor[]; routes: Record<string, string>; onClose: () => void; onProceed: (decisions: Record<string, boolean>) => void;
}) {
  const sorted = [...actors].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  const [selected, setSelected] = useState(sorted[0].id);
  const [decisions, setDecisions] = useState<Record<string, boolean>>({});
  const remaining = sorted.filter((actor) => decisions[actor.id] === undefined);
  const actor = sorted.find((actor) => actor.id === selected)!;
  const proceeds = remaining.every((item) => item.id === selected);
  function adjudicate(move: boolean) {
    const next = { ...decisions, [selected]: move };
    setDecisions(next);
    const pending = sorted.find((actor) => next[actor.id] === undefined);
    if (pending) setSelected(pending.id); else onProceed(next);
  }
  return <StatusDialog title="Skill check required" onClose={onClose} cancelOnBackdrop showClose>
    <div className="mb-4 flex flex-wrap justify-center gap-3" aria-label="Skill check actors">{sorted.map((item) => {
      const decision = decisions[item.id];
      const Icon = decision === undefined ? CircleHelp : decision ? CircleCheck : CircleX;
      return <button key={item.id} aria-label={`Adjudicate ${item.name}: ${decision === undefined ? "unadjudicated" : decision ? "move" : "remain"}`} aria-pressed={selected === item.id} className={`${button} flex w-24 flex-col items-center gap-2 ${selected === item.id ? "bg-canvas" : ""}`} onClick={() => setSelected(item.id)} type="button">
        <svg aria-hidden="true" viewBox="-36 -36 72 72" className="h-16 w-16"><ActorVisual actor={item} fillColor="#64748b" outlineColor="#64748b" selected={false} selectedTextColor="#ffffff" showFactionOutline={false} radius={25} clipId={`skill-${item.id}`} transition={{ duration: 0 }} /></svg>
        <span className="w-full break-words text-center">{item.name}</span><Icon aria-hidden="true" className={`h-5 w-5 ${decision === undefined ? "text-amber-600" : decision ? "text-green-600" : "text-red-600"}`} />
      </button>;
    })}</div>
    <p className="mb-3 break-words text-center text-sm">{actor.name}: {routes[actor.id]}</p>
    <div className="flex flex-wrap justify-center gap-2"><button className={button} onClick={() => adjudicate(false)} type="button">Remain in current zone{proceeds ? " and proceed" : ""}</button><button className={button} onClick={() => adjudicate(true)} type="button">Move to zone{proceeds ? " and proceed" : ""}</button></div>
    <button className={`${button} mt-3 w-full`} disabled={!remaining.length} onClick={() => onProceed(Object.fromEntries(sorted.map((item) => [item.id, decisions[item.id] ?? true])))} type="button">Move all unadjudicated actors and proceed</button>
  </StatusDialog>;
}
