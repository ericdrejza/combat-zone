import { Minus, Plus, X } from "lucide-react";
import { useId } from "react";
import type { CombatRules } from "@entities/actor/actorResources";
import { RepeatButton } from "@ui/controls/RepeatButton";

const buttonClassName = "rounded p-2 enabled:hover:bg-canvas-surface enabled:hover:text-canvas-ink focus-visible:ring-2 focus-visible:ring-canvas-ink disabled:cursor-not-allowed disabled:text-canvas-muted disabled:opacity-40";

/** Keeps numeric entry separate from repeatable steps that save immediately. */
export function HealthThresholdField({ label, value, unit, onChange, onCommit, onBlur }: {
  label: string;
  value: number | null;
  unit: CombatRules["unit"];
  onChange: (value: number | null) => void;
  onCommit: (value: number | null) => void;
  onBlur: () => void;
}) {
  const id = useId();
  const percentage = unit === "percent";
  const minimum = percentage ? 0 : Number.MIN_SAFE_INTEGER;
  const maximum = percentage ? 100 : Number.MAX_SAFE_INTEGER;
  const decreaseDisabled = value !== null && value <= minimum;
  const increaseDisabled = value !== null && value >= maximum;
  function step(amount: number) {
    if (amount < 0 ? decreaseDisabled : increaseDisabled) return;
    const next = value === null ? 0 : value + amount;
    if (Number.isSafeInteger(next)) onCommit(Math.max(minimum, Math.min(maximum, next)));
  }
  return <div className="flex items-center justify-between gap-3 text-sm">
    <label htmlFor={id}>{label}</label>
    <div className="flex shrink-0 items-center gap-1">
      <button type="button" aria-label={`Clear ${label.toLowerCase()} cutoff`} title={value === null ? "No cutoff configured" : `Clear ${label.toLowerCase()} cutoff`} disabled={value === null} className={buttonClassName} onClick={() => onCommit(null)}><X aria-hidden="true" className="h-4 w-4" /></button>
      <RepeatButton type="button" aria-label={`Decrease ${label.toLowerCase()} cutoff`} title={decreaseDisabled ? "Minimum cutoff reached" : `Decrease ${label.toLowerCase()} cutoff`} disabled={decreaseDisabled} className={buttonClassName} onClick={() => step(-1)}><Minus aria-hidden="true" className="h-4 w-4" /></RepeatButton>
      <label htmlFor={id} className="inline-flex w-24 items-center justify-center rounded border border-canvas-line bg-canvas px-2 py-2 focus-within:ring-2 focus-within:ring-canvas-ink">
        <input id={id} aria-label={`${label} upper cutoff`} className="min-w-0 bg-transparent p-0 text-center tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" style={{ width: `${value === null ? 2 : String(value).length}ch` }} type="number" step="1" min={percentage ? 0 : undefined} max={percentage ? 100 : undefined} value={value ?? ""} onChange={(event) => onChange(event.currentTarget.value === "" ? null : Number(event.currentTarget.value))} onBlur={onBlur} onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.stopPropagation();
            event.currentTarget.blur();
            return;
          }
          if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
          event.preventDefault();
          step(event.key === "ArrowUp" ? 1 : -1);
        }} />
        {percentage && value !== null ? <span aria-hidden="true" className="pointer-events-none">%</span> : null}
      </label>
      <RepeatButton type="button" aria-label={`Increase ${label.toLowerCase()} cutoff`} title={increaseDisabled ? "Maximum cutoff reached" : `Increase ${label.toLowerCase()} cutoff`} disabled={increaseDisabled} className={buttonClassName} onClick={() => step(1)}><Plus aria-hidden="true" className="h-4 w-4" /></RepeatButton>
    </div>
  </div>;
}
