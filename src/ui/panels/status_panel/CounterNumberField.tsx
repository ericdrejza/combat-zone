import { RepeatButton } from "@ui/controls/RepeatButton";
import { Minus, Plus, X } from "lucide-react";
import { useId, type ReactNode } from "react";

const buttonClassName = "rounded p-2 enabled:hover:bg-canvas-surface enabled:hover:text-canvas-ink focus-visible:ring-2 focus-visible:ring-canvas-ink disabled:cursor-not-allowed disabled:border-canvas-line disabled:bg-canvas-surface disabled:text-canvas-muted disabled:opacity-40";

/** Explicit stepping gives unset fields predictable starting values in every browser. */
export function CounterNumberField({ label, name, value, optional = false, emptyIncrementValue = 0, beforeDecrement, afterIncrement, minimum, maximum, onChange }: {
  label: string;
  name: string;
  value: string;
  optional?: boolean;
  emptyIncrementValue?: number;
  beforeDecrement?: ReactNode;
  afterIncrement?: ReactNode;
  minimum?: number;
  maximum?: number;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const decreaseDisabled = value.trim() !== "" && minimum !== undefined && Number(value) <= minimum;
  const increaseDisabled = value.trim() !== "" && maximum !== undefined && Number(value) >= maximum;
  function step(amount: number) {
    if (amount < 0 ? decreaseDisabled : increaseDisabled) return;
    const next = value.trim() === "" ? (amount > 0 ? emptyIncrementValue : 0) : Number(value) + amount;
    if (Number.isSafeInteger(next)) onChange(String(next));
  }
  return <div className="text-sm">
    <label htmlFor={id}>{label}</label>
    <div className="mt-1 flex items-center gap-1">
      <input aria-label={label} id={id} className="min-w-0 flex-1 rounded border border-canvas-line bg-canvas p-2 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" type="number" step="1" value={value} onChange={(event) => onChange(event.currentTarget.value)} onKeyDown={(event) => {
        if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
        event.preventDefault(); event.stopPropagation();
        step(event.key === "ArrowUp" ? 1 : -1);
      }} />
      {beforeDecrement}
      <RepeatButton aria-label={`Decrease ${name}`} title={decreaseDisabled ? "Minimum reached" : `Decrease ${name}`} disabled={decreaseDisabled} className={buttonClassName} onClick={() => step(-1)} type="button"><Minus aria-hidden="true" className="h-4 w-4" /></RepeatButton>
      <RepeatButton aria-label={`Increase ${name}`} title={increaseDisabled ? "Maximum reached" : `Increase ${name}`} disabled={increaseDisabled} className={buttonClassName} onClick={() => step(1)} type="button"><Plus aria-hidden="true" className="h-4 w-4" /></RepeatButton>
      {afterIncrement}
      {optional ? <button aria-label={`Clear ${name}`} title={value === "" ? `No ${name} configured` : `Clear ${name}`} disabled={value === ""} className={buttonClassName} onClick={() => onChange("")} type="button"><X aria-hidden="true" className="h-4 w-4" /></button> : null}
    </div>
  </div>;
}
