import { Minus, Plus } from "lucide-react";

const buttonClassName = "flex h-8 shrink-0 items-center justify-center rounded p-2 enabled:hover:bg-canvas-surface enabled:hover:text-canvas-ink focus-visible:ring-2 focus-visible:ring-canvas-ink disabled:cursor-not-allowed disabled:border-canvas-line disabled:bg-canvas-surface disabled:text-canvas-muted disabled:opacity-40";

/** Accessible amount stepping preserves the positive integer minimum. */
export function DamageHealingAmountField({ value, disabled, onChange }: {
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
  return <div className="flex min-w-0 flex-1 items-end gap-1">
    <input aria-label="Damage or healing amount" className="h-8 min-w-0 flex-1 rounded-lg border border-canvas-line bg-canvas px-2 py-0 text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none disabled:cursor-not-allowed disabled:border-canvas-line disabled:bg-canvas-surface disabled:text-canvas-muted disabled:opacity-40" type="number" min="1" step="1" value={value} disabled={disabled} onChange={(event) => onChange(event.currentTarget.value)} onKeyDown={(event) => {
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
      event.preventDefault(); event.stopPropagation();
      step(event.key === "ArrowUp" ? 1 : -1);
    }} />
    <button aria-label="Decrease damage or healing amount" title={disabled ? "Read-only encounter" : atMinimum ? "Minimum amount is 1" : "Decrease damage or healing amount"} disabled={disabled || atMinimum} className={buttonClassName} onClick={() => step(-1)} type="button"><Minus aria-hidden="true" className="h-4 w-4" /></button>
    <button aria-label="Increase damage or healing amount" title={disabled ? "Read-only encounter" : "Increase damage or healing amount"} disabled={disabled} className={buttonClassName} onClick={() => step(1)} type="button"><Plus aria-hidden="true" className="h-4 w-4" /></button>
  </div>;
}
