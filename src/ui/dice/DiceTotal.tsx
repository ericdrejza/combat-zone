import { useId, useRef, useState } from "react";
import type { RollInvocation, DiceResult } from "@core/dice/types";
import { checkOutcome } from "@core/dice/checkRolls";
import { labelBreakdown } from "@core/dice/labelBreakdown";
import { StatusTooltipPopup } from "@ui/status/StatusTooltipPopup";
import { TouchTooltip } from "@ui/toolbar/TouchTooltip";

/** Label subtotals describe this saved result without changing its formula or applications. */
export function DiceTotal({ result, invocation }: { result: DiceResult; invocation?: RollInvocation }) {
  const anchor = useRef<HTMLParagraphElement>(null);
  const id = useId();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const breakdown = labelBreakdown(result.node);
  const hasBreakdown = breakdown.length > 0;
  const visible = hasBreakdown && (hovered || focused);
  const outcome = checkOutcome(invocation, result);
  const total = <p ref={anchor} tabIndex={hasBreakdown ? 0 : undefined} aria-describedby={visible ? id : undefined}
    className={`font-semibold ${hasBreakdown ? "rounded hover:text-canvas-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-canvas-ink" : ""}`}
    onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
    onKeyDown={event => { if (event.key === "Escape") { setHovered(false); setFocused(false); } }}>
    {result.outcome === "successes" ? "Successes" : result.outcome === "matches" ? "Matches" : "Total"}: {result.node.value}{outcome ? <span> · {outcome}</span> : null}
  </p>;
  return <>{hasBreakdown ? <TouchTooltip tone="panel" label={breakdown.map(({ label, value }) => `${label}: ${value}`).join("; ")}>{total}</TouchTooltip> : total}
    {visible && anchor.current ? <StatusTooltipPopup anchor={anchor.current} id={id} placement="bottom" tone="panel" label={<dl className="space-y-1">{breakdown.map(({ label, value }) => <div key={label} className="flex justify-between gap-4"><dt className="min-w-0 break-words text-left">{label}:</dt><dd>{value}</dd></div>)}</dl>} /> : null}
  </>;
}
