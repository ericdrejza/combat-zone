import { Activity } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { removeMarker } from "@entities/actor/statusMutations";
import { usePersistence } from "@ui/persistence/PersistenceProvider";
import { ConfirmStatusDialog } from "@ui/panels/status_panel/StatusDialog";
import type { StatusMarker } from "@ui/status/markerCatalog";
import { useStatusActions } from "@ui/status/useStatusActions";
import { InitiativeConditionBadge } from "./InitiativeConditionBadge";
import { InitiativeConditionTooltip } from "./InitiativeConditionTooltip";

/** Shows active conditions with confirmed removal, condensing only when necessary. */
export function InitiativeConditionIcons({ actorId, actorName, conditions, collapsed }: { actorId: string; actorName: string; conditions: StatusMarker[]; collapsed: boolean }) {
  const anchor = useRef<HTMLSpanElement>(null);
  const tooltipId = useId();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pending, setPending] = useState<StatusMarker | null>(null);
  const { readOnly } = usePersistence();
  const commit = useStatusActions();
  useEffect(() => {
    if (pending && !conditions.some(({ id }) => id === pending.id)) setPending(null);
  }, [conditions, pending]);
  if (!conditions.length) return null;
  const open = !pending && (hovered || focused);
  function prompt(condition: StatusMarker) { setHovered(false); setFocused(false); setPending(condition); }
  return <>
    {collapsed ? <span ref={anchor} aria-label={`${actorName} conditions`} aria-describedby={open ? tooltipId : undefined} className="shrink-0 rounded text-canvas-muted hover:text-canvas-ink focus-visible:ring-2 focus-visible:ring-canvas-ink" role="img" tabIndex={0} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocus={() => setFocused(true)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget) && !anchor.current?.ownerDocument.getElementById(tooltipId)?.contains(event.relatedTarget)) setFocused(false); }} onClick={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()} onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); setHovered(false); setFocused(false); } }}>
      <Activity aria-hidden="true" className="h-4 w-4" />
      {open && anchor.current ? <InitiativeConditionTooltip anchor={anchor.current} id={tooltipId} conditions={conditions} actorName={actorName} disabled={readOnly} onRemove={prompt} /> : null}
    </span> : <span ref={anchor} aria-label={`${actorName} conditions`} className="flex shrink-0 items-center gap-1" onDoubleClick={(event) => event.stopPropagation()}>
      {conditions.map((condition) => <InitiativeConditionBadge key={condition.id} condition={condition} actorName={actorName} disabled={readOnly} hideTooltip={!!pending} onRemove={prompt} />)}
    </span>}
    {pending && anchor.current ? createPortal(<ConfirmStatusDialog title={`Remove ${pending.label} from ${actorName}?`} onClose={() => setPending(null)} onConfirm={() => {
      void commit("actor.removeCondition", { actorId, condition: pending.id }, (state) => removeMarker(state, actorId, pending.id));
      setPending(null);
    }}><p>Do you want to remove {pending.label} from {actorName}?</p></ConfirmStatusDialog>, anchor.current.ownerDocument.body) : null}
  </>;
}
