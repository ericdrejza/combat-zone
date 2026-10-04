import { getActorStatus } from "@entities/actor/actorStatus";
import type { Actor, ActorStatus } from "@entities/actor/types";
import { HEALTH_STATUSES } from "@ui/status/healthCatalog";
import { TouchTooltip } from "@ui/toolbar/TouchTooltip";

export function HealthStatusControl({ actor, disabled, onChange }: {
  actor: Actor; disabled: boolean; onChange: (status: ActorStatus) => void;
}) {
  const status = getActorStatus(actor);
  return <fieldset><legend className="mb-2 text-sm font-semibold">Health status</legend>
    <div role="radiogroup" aria-label="Health status" className="flex gap-2" onKeyDown={(event) => {
      if (disabled || !["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation();
      const next = event.key === "Home" ? 0 : event.key === "End" ? 3 :
        (status + (["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : 3)) % 4;
      onChange(next as ActorStatus);
      event.currentTarget.querySelector<HTMLButtonElement>(`[data-status="${next}"]`)?.focus();
    }}>
      {HEALTH_STATUSES.map(({ value, label, Icon }) => <TouchTooltip label={label} key={value}><button
        aria-label={label} aria-checked={status === value} role="radio" data-status={value} tabIndex={status === value ? 0 : -1} title={disabled ? `${label}: read-only encounter` : label} disabled={disabled}
        className={`rounded-lg border p-2 enabled:hover:ring-2 enabled:hover:ring-canvas-ink focus-visible:ring-2 focus-visible:ring-canvas-ink disabled:cursor-not-allowed disabled:border-canvas-line disabled:bg-canvas-surface disabled:text-canvas-muted disabled:opacity-40 ${status === value ? "border-canvas-ink bg-canvas-ink text-canvas-on-ink" : "border-canvas-line text-canvas-muted"}`}
        onClick={() => onChange(value)} type="button"><Icon aria-hidden="true" className="h-5 w-5" /></button></TouchTooltip>)}
    </div>
  </fieldset>;
}
