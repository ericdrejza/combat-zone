import { ChevronDown, ChevronUp } from 'lucide-react';
import { stepGridRotation, stepWholeNumber } from '@core/movement/gridRotation';
import { useRef } from 'react';
import { RepeatButton, REPEAT_DELAY_MS } from '@ui/controls/RepeatButton';

export function GridNumberField({ label, value, onChange, positive = false, rotation = false }: {
  label: string; value: number; onChange: (value: number) => void; positive?: boolean; rotation?: boolean;
}) {
  const keyboardHold = useRef<{ key: string; start: number } | null>(null);
  const step = (direction: 1 | -1, increment = 0.1) => {
    const next = rotation ? stepGridRotation(value, direction, increment === 1) : stepWholeNumber(value, direction);
    if (Number.isFinite(next) && (!positive || next > 0)) onChange(next);
  };
  const button = 'flex w-9 flex-1 items-center justify-center enabled:hover:bg-canvas-surface focus-visible:ring-2 focus-visible:ring-canvas-ink disabled:cursor-not-allowed disabled:opacity-40';
  const StepButton = rotation ? RepeatButton : 'button';
  return <label className="block space-y-1 text-sm">{label}
    <span className="flex min-h-11 overflow-hidden rounded-lg border border-canvas-line focus-within:ring-2 focus-within:ring-canvas-ink">
      <input aria-label={label} type="number" step={rotation ? '0.01' : 'any'} value={Number.isFinite(value) ? value : ''}
        className="min-w-0 flex-1 bg-canvas-surface p-2 text-canvas-ink outline-none hover:bg-canvas [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        onChange={event => onChange(event.currentTarget.valueAsNumber)}
        onBlur={() => { keyboardHold.current = null; }} onKeyUp={() => { keyboardHold.current = null; }}
        onKeyDown={event => { if (!event.ctrlKey && !event.metaKey && !event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
          event.preventDefault();
          if (!event.repeat || keyboardHold.current?.key !== event.key) keyboardHold.current = { key: event.key, start: performance.now() };
          const accelerated = rotation && performance.now() - keyboardHold.current.start >= REPEAT_DELAY_MS;
          step(event.key === 'ArrowUp' ? 1 : -1, accelerated ? 1 : 0.1);
        } }} />
      <span className="flex flex-col border-l border-canvas-line">
        <StepButton className={button} type="button" title={`Increase ${label}`} aria-label={`Increase ${label}`} disabled={!Number.isFinite(value)} onClick={() => step(1)} {...(rotation ? { onRepeat: () => step(1, 1) } : {})}><ChevronUp size={14} /></StepButton>
        <StepButton className={button} type="button" title={`Decrease ${label}`} aria-label={`Decrease ${label}`} disabled={!Number.isFinite(value) || (positive && stepWholeNumber(value, -1) <= 0)} onClick={() => step(-1)} {...(rotation ? { onRepeat: () => step(-1, 1) } : {})}><ChevronDown size={14} /></StepButton>
      </span>
    </span>
  </label>;
}
