import { Delete } from "lucide-react";
import { useState } from "react";

import { getActorStatus } from "@entities/actor/actorStatus";
import type { Actor, ActorStatus } from "@entities/actor/types";

import { HEALTH_STATUSES as statuses } from "@ui/status/healthCatalog";

/** Overlays the row without letting health choices select or drag its actor. */
export function InitiativeStatusControl({ actor, onRemove, onStatusChange }: {
  actor: Actor;
  onRemove: (actorId: string) => void;
  onStatusChange: (actorId: string, status: ActorStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const status = getActorStatus(actor);
  const current = statuses[status];
  return <>
    <button aria-label={`${actor.name} status: ${current.label}`} aria-expanded={open} className="text-canvas-muted hover:text-canvas-ink" onClick={(event) => { event.stopPropagation(); setOpen(!open); }} onDoubleClick={(event) => event.stopPropagation()} title={current.label} type="button">
      <current.Icon aria-hidden="true" className="h-4 w-4" />
    </button>
    {open ? <div aria-label={`${actor.name} status options`} className="absolute inset-0 z-10 flex items-center justify-around rounded-xl border border-canvas-line bg-canvas-panel" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }} onClick={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()} onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); setOpen(false); } }} role="group">
      <button aria-label={`Remove ${actor.name} from initiative`} autoFocus className="p-2 text-canvas-muted hover:text-red-700 dark:hover:text-red-500" onClick={() => { setOpen(false); onRemove(actor.id); }} title="Remove from initiative" type="button"><Delete aria-hidden="true" className="h-4 w-4" /></button>
      {statuses.map(({ value, label, Icon }) => <button aria-label={`Set ${actor.name} status: ${label}`} aria-pressed={status === value} className="p-2 text-canvas-muted hover:text-canvas-ink" key={value} onClick={() => { setOpen(false); onStatusChange(actor.id, value); }} title={label} type="button"><Icon aria-hidden="true" className="h-4 w-4" /></button>)}
    </div> : null}
  </>;
}
