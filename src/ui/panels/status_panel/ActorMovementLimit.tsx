import { Minus, Plus } from 'lucide-react';
import { useRef } from 'react';
import type { Actor } from '@entities/actor/types';
import { usePersistence } from '@ui/persistence/PersistenceProvider';
import { SETTINGS_CONTROL } from '@ui/settings/SettingsLayout';
import { TouchTooltip } from '@ui/toolbar/TouchTooltip';
import { RepeatButton } from '@ui/controls/RepeatButton';

export function ActorMovementLimit({ actor, unit, step, onChange }: { actor: Actor; unit: string; step: number; onChange: (value: number | null) => void }) {
  const { readOnly } = usePersistence();
  const inputRef = useRef<HTMLInputElement>(null);
  function adjust(direction: number) {
    const input = inputRef.current;
    if (!input || readOnly) return;
    if (direction > 0) input.stepUp();
    else input.stepDown();
    // Commit the stepped value before removing the typing cursor on touch devices.
    if (input.ownerDocument.activeElement === input) input.blur();
    else if (Number.isFinite(input.valueAsNumber)) onChange(input.valueAsNumber);
  }
  function stepButton(direction: number) {
    const label = direction > 0 ? 'Increase movement limit' : 'Decrease movement limit';
    const Icon = direction > 0 ? Plus : Minus;
    return <TouchTooltip label={`${label} (hold to repeat)`}><RepeatButton type="button" aria-label={label} title={label} disabled={readOnly}
      className={`flex min-h-11 w-6 shrink-0 items-center justify-center border border-canvas-line bg-canvas-surface text-canvas-ink ${direction > 0 ? 'rounded-r-xl border-l-0' : 'rounded-l-xl border-r-0'} enabled:hover:bg-canvas enabled:hover:text-canvas-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canvas-ink disabled:cursor-not-allowed disabled:bg-canvas disabled:text-canvas-muted disabled:opacity-50`}
      onClick={() => adjust(direction)}><Icon aria-hidden="true" className="h-3 w-3" /></RepeatButton></TouchTooltip>;
  }
  return <div className="flex items-center justify-between gap-4"><label htmlFor={`movement-limit-${actor.id}`} className="shrink-0 font-semibold">Movement ({unit})</label>
    <div className="flex w-32 min-w-0 items-stretch">
      {stepButton(-1)}
      <input ref={inputRef} id={`movement-limit-${actor.id}`} key={`${actor.id}:${actor.movementLimit}`} aria-label="Movement limit" type="number" min="0" step={step}
        disabled={readOnly} className={`${SETTINGS_CONTROL} flex-1 rounded-none text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`} defaultValue={actor.movementLimit ?? ''} placeholder="No limit"
        onFocus={event => event.currentTarget.select()} onClick={event => event.currentTarget.select()}
        onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }}
        onBlur={event => {
          const input = event.currentTarget;
          if (!input.value) onChange(null);
          // Grid distance controls stepping; manually entered limits may use any nonnegative distance.
          else if (Number.isFinite(input.valueAsNumber) && input.valueAsNumber >= 0) onChange(input.valueAsNumber);
          else input.value = String(actor.movementLimit ?? '');
        }} />
      {stepButton(1)}
    </div>
  </div>;
}
