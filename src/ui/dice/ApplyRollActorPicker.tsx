import { Check, RotateCcwClock } from "lucide-react";
import { useId, type ReactNode } from "react";
import type { Actor, ActorLayoutGroup } from "@entities/actor/types";
import { ACTOR_LAYOUT_GROUP_COLORS } from "@entities/actor/actorVisuals";
import { ActorVisual } from "@ui/canvas/actors/ActorVisual";
import { TouchTooltip } from "@ui/toolbar/TouchTooltip";
import { previewDiceTarget } from "./MentionSuggestions";

export const APPLY_FACTIONS: ActorLayoutGroup[] = ["hero", "ally", "enemy", "neutral"];
/** Faction sections and the ungrouped view share stable actor keys and controlled selection. */
export function ApplyRollActorPicker({ actors, grouped, selected, disabled, applied, onToggle, renderAmount }: {
  actors: Actor[]; grouped: boolean; selected: Set<string>; disabled: boolean; applied: Set<string>;
  onToggle: (id: string) => void; renderAmount: (actor: Actor) => ReactNode;
}) {
  const groups = grouped ? APPLY_FACTIONS.map(faction => ({ faction, actors: actors.filter(a => a.layoutGroup === faction) })).filter(group => group.actors.length) : [{ faction: null, actors }];
  return <div className="max-h-[50vh] space-y-3 overflow-y-auto p-1">{groups.map(group => <section key={group.faction ?? "all"} aria-label={group.faction ?? "All actors"}>
    {group.faction ? <h4 className="mb-2 flex items-center gap-2 font-semibold capitalize">{group.faction}<span aria-hidden="true" className="h-3 w-3 rounded-full" style={{ backgroundColor: ACTOR_LAYOUT_GROUP_COLORS[group.faction].fill }} /></h4> : null}
    <div className="grid grid-cols-[repeat(auto-fill,minmax(min(6rem,100%),1fr))] items-start gap-2">{group.actors.map(actor => <div key={actor.id} className="min-w-0 [&>span]:w-full" onMouseEnter={() => previewDiceTarget(actor.id)} onMouseLeave={() => previewDiceTarget(null)} onFocus={() => previewDiceTarget(actor.id)} onBlur={() => previewDiceTarget(null)}>
      <ActorTile applied={applied.has(actor.id)} actor={actor} checked={selected.has(actor.id) && !!actor.hitPoints} disabled={disabled} onToggle={() => onToggle(actor.id)} />
      {selected.has(actor.id) && actor.hitPoints ? renderAmount(actor) : null}
    </div>)}</div>
  </section>)}</div>;
}
function ActorTile({ actor, checked, disabled, applied, onToggle }: { actor: Actor; checked: boolean; disabled: boolean; applied: boolean; onToggle: () => void }) {
  const clipId = useId();
  const colors = ACTOR_LAYOUT_GROUP_COLORS[actor.layoutGroup];
  const unavailable = !actor.hitPoints;
  const help = unavailable ? "No hit points configured" : `${checked ? "Deselect" : "Select"} ${actor.name}`;
  return <TouchTooltip label={help}><span className="block w-full" title={unavailable ? help : undefined}>
    <button type="button" role="checkbox" aria-label={actor.name} aria-checked={checked} disabled={disabled || unavailable} title={unavailable ? help : undefined} onClick={onToggle}
      className={`relative flex w-full min-w-0 flex-col items-center gap-2 rounded-xl border p-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canvas-ink disabled:cursor-not-allowed disabled:text-canvas-muted disabled:opacity-40 ${checked ? "border-canvas-ink bg-canvas-surface enabled:hover:bg-canvas" : "border-canvas-line enabled:hover:bg-canvas-surface"}`}>
      <span className="relative flex h-16 w-16 shrink-0 items-center justify-center">
        <svg role="img" aria-label={`${actor.name} token`} viewBox="-36 -36 72 72" className="h-16 w-16 overflow-visible">
          <ActorVisual actor={actor} fillColor={colors.fill} outlineColor={colors.outline} radius={30} selected={false} selectedTextColor="#ffffff" showFactionOutline={false} clipId={clipId} transition={{ duration: 0 }} />
        </svg>
        {checked ? <span aria-hidden="true" className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-canvas-ink text-canvas-on-ink shadow-sm"><Check className="h-4 w-4" /></span> : null}
      </span>
        {applied ? <span className="absolute left-1 top-1"><TouchTooltip label="This actor has already applied this effect"><span title="This actor has already applied this effect" aria-label="This actor has already applied this effect" className="flex h-6 w-6 items-center justify-center rounded-full bg-canvas-surface text-canvas-muted shadow-sm"><RotateCcwClock aria-hidden="true" className="h-4 w-4" /></span></TouchTooltip></span> : null}
      <span className={`w-full min-w-0 break-words text-center ${unavailable ? "text-canvas-muted" : "text-canvas-ink"}`}>{actor.name}</span>
    </button>
  </span></TouchTooltip>;
}
