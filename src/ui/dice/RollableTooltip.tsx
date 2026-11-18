import { useId, useRef, useState, type ReactNode } from "react";
import type { Rollable } from "@core/dice/types";
import { StatusTooltipPopup } from "@ui/status/StatusTooltipPopup";
import { TouchTooltip } from "@ui/toolbar/TouchTooltip";

/** Rich desktop/focus help and delegated touch help expose the same saved setup. */
export function RollableTooltip({ rollable, children }: { rollable: Rollable; children: ReactNode }) {
  const anchor = useRef<HTMLSpanElement>(null);
  const id = useId();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const formulas = [rollable.checkFormula, rollable.effectFormula].filter(Boolean).join(" · ");
  const kind = rollable.effectKind === "none" ? "" : rollable.effectKind;
  const label = <>{formulas}{kind ? <> · <em>{kind}</em></> : null}</>;
  return <TouchTooltip label={`${formulas}${kind ? ` · ${kind}` : ""}`}><span ref={anchor} className="inline-flex" aria-describedby={hovered || focused ? id : undefined}
    onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}>
    {children}
    {(hovered || focused) && anchor.current ? <StatusTooltipPopup anchor={anchor.current} label={label} id={id} /> : null}
  </span></TouchTooltip>;
}
