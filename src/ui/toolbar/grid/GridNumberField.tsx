import { ChevronDown, ChevronUp } from 'lucide-react';
import { stepGridRotation, stepWholeNumber } from '@core/movement/gridRotation';
import { useRef, useState } from 'react';
import { RepeatButton, REPEAT_DELAY_MS } from '@ui/controls/RepeatButton';

export function GridNumberField({ label, value, onChange, positive = false, rotation = false }: {
  label: string; value: number; onChange: (value: number) => void; positive?: boolean; rotation?: boolean;
}) {
  const keyboardHold = useRef<{ key: string; start: number } | null>(null);
  const lastPositiveValue = useRef(value);
  if (Number.isFinite(value) && value > 0) lastPositiveValue.current = value;
  // Preserve incomplete typing locally so it cannot resize or rotate the preview.
  const [draft, setDraft] = useState<{ text: string; number: number } | null>(null);
  const currentValue = draft?.number ?? value;
  const publish = (next: number) => { setDraft(null); onChange(next); };
  const step = (direction: 1 | -1, increment = 0.1) => {
    const next = rotation ? stepGridRotation(currentValue, direction, increment === 1) : stepWholeNumber(currentValue, direction);
    if (Number.isFinite(next) && (!positive || next > 0)) publish(next);
  };
  const button = 'flex w-9 flex-1 items-center justify-center enabled:hover:bg-canvas-surface focus-visible:ring-2 focus-visible:ring-canvas-ink disabled:cursor-not-allowed disabled:opacity-40';
  return <label className="block space-y-1 text-sm">{label}
    <span className="flex min-h-11 overflow-hidden rounded-lg border border-canvas-line focus-within:ring-2 focus-within:ring-canvas-ink">
      <input aria-label={label} type="number" step={rotation ? '0.01' : 'any'} value={draft?.text ?? (Number.isFinite(value) ? value : '')}
        onFocus={event => event.currentTarget.select()} onClick={event => event.currentTarget.select()}
        className="min-w-0 flex-1 bg-canvas-surface p-2 text-canvas-ink outline-none hover:bg-canvas [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        onChange={event => setDraft({ text: event.currentTarget.value, number: event.currentTarget.valueAsNumber })}
        onBlur={() => {
          keyboardHold.current = null;
          if (draft && draft.text !== '') publish(draft.number);
          else if (draft && !positive) publish(0);
          else if (draft) {
            setDraft(null);
            if (value !== lastPositiveValue.current) onChange(lastPositiveValue.current);
          }
        }} onKeyUp={() => { keyboardHold.current = null; }}
        onKeyDown={event => {
          if (event.key === 'Enter') event.currentTarget.blur();
          if (!event.ctrlKey && !event.metaKey && !event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
          event.preventDefault();
          if (!event.repeat || keyboardHold.current?.key !== event.key) keyboardHold.current = { key: event.key, start: performance.now() };
          const accelerated = rotation && performance.now() - keyboardHold.current.start >= REPEAT_DELAY_MS;
          step(event.key === 'ArrowUp' ? 1 : -1, accelerated ? 1 : 0.1);
        } }} />
      <span className="flex flex-col border-l border-canvas-line">
        <RepeatButton className={button} type="button" title={`Increase ${label}`} aria-label={`Increase ${label}`} disabled={!Number.isFinite(currentValue)} onClick={() => step(1)} onRepeat={() => step(1, 1)}><ChevronUp size={14} /></RepeatButton>
        <RepeatButton className={button} type="button" title={`Decrease ${label}`} aria-label={`Decrease ${label}`} disabled={!Number.isFinite(currentValue) || (positive && stepWholeNumber(currentValue, -1) <= 0)} onClick={() => step(-1)} onRepeat={() => step(-1, 1)}><ChevronDown size={14} /></RepeatButton>
      </span>
    </span>
  </label>;
}
