import { ChevronDown, ChevronUp } from 'lucide-react';
import { stepWholeNumber } from '@core/movement/gridRotation';

export function GridNumberField({ label, value, onChange, positive = false }: {
  label: string; value: number; onChange: (value: number) => void; positive?: boolean;
}) {
  const step = (direction: 1 | -1) => {
    const next = stepWholeNumber(value, direction);
    if (Number.isFinite(next) && (!positive || next > 0)) onChange(next);
  };
  const button = 'flex w-9 flex-1 items-center justify-center enabled:hover:bg-canvas-surface focus-visible:ring-2 focus-visible:ring-canvas-ink disabled:cursor-not-allowed disabled:opacity-40';
  return <label className="block space-y-1 text-sm">{label}
    <span className="flex min-h-11 overflow-hidden rounded-lg border border-canvas-line focus-within:ring-2 focus-within:ring-canvas-ink">
      <input aria-label={label} type="number" step="any" value={Number.isFinite(value) ? value : ''}
        className="min-w-0 flex-1 bg-canvas-surface p-2 text-canvas-ink outline-none hover:bg-canvas [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        onChange={event => onChange(event.currentTarget.valueAsNumber)}
        onKeyDown={event => { if (!event.ctrlKey && !event.metaKey && !event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) { event.preventDefault(); step(event.key === 'ArrowUp' ? 1 : -1); } }} />
      <span className="flex flex-col border-l border-canvas-line">
        <button className={button} type="button" aria-label={`Increase ${label}`} disabled={!Number.isFinite(value)} onClick={() => step(1)}><ChevronUp size={14} /></button>
        <button className={button} type="button" aria-label={`Decrease ${label}`} disabled={!Number.isFinite(value) || (positive && stepWholeNumber(value, -1) <= 0)} onClick={() => step(-1)}><ChevronDown size={14} /></button>
      </span>
    </span>
  </label>;
}
