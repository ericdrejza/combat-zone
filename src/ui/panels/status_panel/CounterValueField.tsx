import { ArrowDownToLine, ArrowUpToLine } from "lucide-react";
import { TouchTooltip } from "@ui/toolbar/TouchTooltip";
import { CounterNumberField } from "./CounterNumberField";

const buttonClassName = "shrink-0 rounded p-2 enabled:hover:bg-canvas-surface enabled:hover:text-canvas-ink focus-visible:ring-2 focus-visible:ring-canvas-ink disabled:cursor-not-allowed disabled:border-canvas-line disabled:bg-canvas-surface disabled:text-canvas-muted disabled:opacity-40";

/** Bound shortcuts edit the modal draft; Save remains the only encounter mutation. */
export function CounterValueField({ value, minimum, maximum, onChange }: {
  value: string;
  minimum?: number;
  maximum?: number;
  onChange: (value: string) => void;
}) {
  const minimumTooltip = minimum === undefined ? "Set to minimum (0 by default)" : "Set to minimum";
  return <CounterNumberField label="Current value" name="current value" value={value} minimum={minimum} maximum={maximum} onChange={onChange} afterIncrement={<>
    <TouchTooltip label={minimumTooltip}>
      <button aria-label="Set to minimum" title={minimumTooltip} className={buttonClassName} onClick={() => onChange(String(minimum ?? 0))} type="button"><ArrowDownToLine aria-hidden="true" className="h-4 w-4" /></button>
    </TouchTooltip>
    <TouchTooltip label="Set to maximum">
      <button aria-label="Set to maximum" title="Set to maximum" disabled={maximum === undefined} className={buttonClassName} onClick={() => { if (maximum !== undefined) onChange(String(maximum)); }} type="button"><ArrowUpToLine aria-hidden="true" className="h-4 w-4" /></button>
    </TouchTooltip>
  </>} />;
}
