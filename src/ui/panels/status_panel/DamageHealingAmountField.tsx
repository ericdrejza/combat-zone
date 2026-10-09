import { RepeatButton } from "@ui/controls/RepeatButton";
import { Minus, Plus } from "lucide-react";

const buttonClassName = "flex h-8 shrink-0 items-center justify-center rounded p-2 enabled:hover:bg-canvas-surface enabled:hover:text-canvas-ink focus-visible:ring-2 focus-visible:ring-canvas-ink disabled:cursor-not-allowed disabled:border-canvas-line disabled:bg-canvas-surface disabled:text-canvas-muted disabled:opacity-40";

/** Accessible amount stepping preserves the positive integer minimum. */
export function DamageHealingAmountField({ value, disabled, onChange, initialFocus = false, onConfirmValue }: {
  initialFocus?: boolean;
  onConfirmValue?: () => void;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const atMinimum = value.trim() !== "" && Number(value) <= 1;
  function step(direction: number) {
    if (disabled || (direction < 0 && atMinimum)) return;
    const next = value.trim() === "" ? 1 : Math.max(1, Number(value) + direction);
    if (Number.isSafeInteger(next)) onChange(String(next));
  }
  return <div className="flex w-fit max-w-full items-end gap-1">
    <RepeatButton aria-label="Decrease damage or healing amount" title={disabled ? "Read-only encounter" : atMinimum ? "Minimum amount is 1" : "Decrease damage or healing amount"} disabled={disabled || atMinimum} className={buttonClassName} onClick={() => step(-1)} type="button"><Minus aria-hidden="true" className="h-4 w-4" /></RepeatButton>
    <input data-dialog-initial-focus={initialFocus || undefined} aria-label="Damage or healing amount" className="h-8 min-w-0 max-w-full rounded-lg focus-visible:ring-2 focus-visible:ring-canvas-ink border border-canvas-line bg-canvas px-2 py-0 text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none disabled:cursor-not-allowed disabled:border-canvas-line disabled:bg-canvas-surface disabled:text-canvas-muted disabled:opacity-40" style={{ width: `${Math.max(2, value.length)}ch`, boxSizing: "content-box" }} type="text" inputMode="numeric" pattern="[0-9]*" value={value} disabled={disabled} onFocus={(event) => event.currentTarget.select()} onClick={(event) => event.currentTarget.select()} onChange={(event) => { if (/^\d*$/.test(event.currentTarget.value)) onChange(event.currentTarget.value); }} onKeyDown={(event) => {
      if (event.key === "Enter" && onConfirmValue) {
        event.preventDefault(); event.stopPropagation(); onConfirmValue(); return;
      }
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
      event.preventDefault(); event.stopPropagation();
      step(event.key === "ArrowUp" ? 1 : -1);
    }} />

    <RepeatButton aria-label="Increase damage or healing amount" title={disabled ? "Read-only encounter" : "Increase damage or healing amount"} disabled={disabled} className={buttonClassName} onClick={() => step(1)} type="button"><Plus aria-hidden="true" className="h-4 w-4" /></RepeatButton>
  </div>;
}
